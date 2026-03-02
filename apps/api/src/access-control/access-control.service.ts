import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuthUser,
  BranchScopeType,
  IndustryPreset,
  PermissionGroup,
  Role,
  UserStatus,
} from '@leadops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { getTenantContext } from '../tenant/tenant.store';
import {
  getAdminRoleName,
  getAllPermissionKeys,
  getDefaultBranchNames,
  getDefaultRoleTemplates,
  getLegacyRoleTemplateName,
  PERMISSION_CATALOG,
} from './permission-catalog';

interface BasicUserRecord {
  id: string;
  tenantId: string;
  role: string;
  isTenantAdmin: boolean;
}

@Injectable()
export class AccessControlService {
  private readonly authUserCache = new Map<string, Promise<AuthUser>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async buildAuthUser(userId: string, tenantId?: string, requestId?: string): Promise<AuthUser> {
    const activeTenantId = tenantId ?? getTenantContext(false)?.tenantId;
    if (!activeTenantId || activeTenantId === 'system') {
      throw new ForbiddenException('Tenant context missing for permission resolution');
    }

    const activeRequestId = requestId ?? getTenantContext(false)?.requestId;
    if (!activeRequestId) {
      return this.buildAuthUserFresh(userId, activeTenantId);
    }

    const cacheKey = `${activeRequestId}:${userId}`;
    const cached = this.authUserCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const next = this.buildAuthUserFresh(userId, activeTenantId);
    this.authUserCache.set(cacheKey, next);

    if (this.authUserCache.size > 500) {
      this.authUserCache.clear();
    }

    return next;
  }

  async listPermissionGroups(): Promise<PermissionGroup[]> {
    await this.ensurePermissionCatalog();

    const records = await this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });

    const grouped = new Map<string, PermissionGroup>();

    for (const record of records) {
      if (!grouped.has(record.group)) {
        grouped.set(record.group, { group: record.group, permissions: [] });
      }

      grouped.get(record.group)?.permissions.push({
        key: record.key,
        description: record.description,
        group: record.group,
      });
    }

    return [...grouped.values()];
  }

  async ensureTenantInitialized(tenantId: string): Promise<void> {
    const profile = await this.tenantConfig.getTenantProfile(tenantId);

    await this.ensurePermissionCatalog();
    await this.ensureTenantRoles(tenantId, profile.industryPreset);
    await this.ensureTenantBranches(tenantId, profile.industryPreset);
  }

  async listTenantBranches(tenantId: string) {
    await this.ensureTenantInitialized(tenantId);

    return this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async getTenantAdminRole(tenantId: string, preset?: IndustryPreset) {
    const activePreset = preset ?? (await this.tenantConfig.getTenantProfile(tenantId)).industryPreset;
    await this.ensureTenantInitialized(tenantId);

    return this.prisma.permissionRole.findUnique({
      where: {
        tenantId_name: {
          tenantId,
          name: getAdminRoleName(activePreset),
        },
      },
    });
  }

  async setUserRoles(
    userId: string,
    tenantId: string,
    roleIds: string[],
    isTenantAdmin: boolean,
    preset?: IndustryPreset,
  ): Promise<void> {
    await this.ensureTenantInitialized(tenantId);

    const activePreset = preset ?? (await this.tenantConfig.getTenantProfile(tenantId)).industryPreset;
    const uniqueRoleIds = [...new Set(roleIds)];
    const scopedRoles =
      uniqueRoleIds.length === 0
        ? []
        : await this.prisma.permissionRole.findMany({
            where: {
              id: { in: uniqueRoleIds },
              OR: [{ tenantId }, { tenantId: null }],
            },
          });

    if (uniqueRoleIds.length > 0 && scopedRoles.length !== uniqueRoleIds.length) {
      throw new ForbiddenException('One or more roles do not belong to this tenant');
    }

    const nextRoleIds = new Set(scopedRoles.map((role) => role.id));

    if (isTenantAdmin) {
      const adminRole = await this.getTenantAdminRole(tenantId, activePreset);
      if (adminRole) {
        nextRoleIds.add(adminRole.id);
      }
    }

    await this.prisma.userRole.deleteMany({ where: { userId } });

    if (nextRoleIds.size > 0) {
      await this.prisma.userRole.createMany({
        data: [...nextRoleIds].map((roleId) => ({ userId, roleId })),
        skipDuplicates: true,
      });
    }
  }

  async setUserBranchScope(
    userId: string,
    tenantId: string,
    input:
      | {
          scopeType: BranchScopeType;
          branchIds: string[];
        }
      | undefined,
  ): Promise<void> {
    if (!input || input.scopeType === BranchScopeType.ALL_BRANCHES) {
      await this.prisma.userBranchScope.deleteMany({ where: { userId } });
      return;
    }

    const branchIds = [...new Set(input.branchIds)];
    const branches =
      branchIds.length === 0
        ? []
        : await this.prisma.branch.findMany({
            where: {
              tenantId,
              id: { in: branchIds },
            },
          });

    if (branches.length !== branchIds.length) {
      throw new ForbiddenException('One or more branches do not belong to this tenant');
    }

    await this.prisma.userBranchScope.deleteMany({ where: { userId } });

    if (branchIds.length > 0) {
      await this.prisma.userBranchScope.createMany({
        data: branchIds.map((branchId) => ({ userId, branchId })),
        skipDuplicates: true,
      });
    }
  }

  determineLegacyRole(input: {
    isSuperAdmin?: boolean;
    isTenantAdmin?: boolean;
    roles?: Array<{ name: string }>;
  }): Role {
    if (input.isSuperAdmin || input.isTenantAdmin) {
      return Role.OWNER;
    }

    const names = new Set((input.roles ?? []).map((role) => role.name.toLowerCase()));
    if (names.has('owner') || names.has('lab admin') || names.has('tenant admin')) {
      return Role.OWNER;
    }

    return Role.STAFF;
  }

  async ensureLegacyAssignment(input: BasicUserRecord): Promise<void> {
    await this.ensureTenantInitialized(input.tenantId);

    const roleCount = await this.prisma.userRole.count({
      where: { userId: input.id },
    });

    if (roleCount > 0) {
      return;
    }

    const preset = (await this.tenantConfig.getTenantProfile(input.tenantId)).industryPreset;
    const defaultRoleName = input.isTenantAdmin
      ? getAdminRoleName(preset)
      : getLegacyRoleTemplateName(
          preset,
          input.role === Role.OWNER ? Role.OWNER : Role.STAFF,
        );

    const targetRole = await this.prisma.permissionRole.findUnique({
      where: {
        tenantId_name: {
          tenantId: input.tenantId,
          name: defaultRoleName,
        },
      },
    });

    if (!targetRole) {
      return;
    }

    await this.setUserRoles(input.id, input.tenantId, [targetRole.id], input.isTenantAdmin, preset);
  }

  private async buildAuthUserFresh(userId: string, tenantId: string): Promise<AuthUser> {
    await this.ensureTenantInitialized(tenantId);

    const basicUser = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        tenantId: true,
        role: true,
        isTenantAdmin: true,
      },
    });

    if (!basicUser) {
      throw new NotFoundException('User not found');
    }

    await this.ensureLegacyAssignment(basicUser);

    const [allBranches, user] = await Promise.all([
      this.prisma.branch.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.findFirst({
        where: { id: userId, tenantId },
        include: {
          defaultBranch: true,
          branchScopes: {
            include: { branch: true },
            orderBy: { branch: { name: 'asc' } },
          },
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: { permission: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const allPermissionKeys = getAllPermissionKeys();
    const permissionSet = new Set<string>();

    if (user.isSuperAdmin || user.isTenantAdmin) {
      for (const key of allPermissionKeys) {
        permissionSet.add(key);
      }
    } else {
      for (const userRole of user.userRoles) {
        for (const rolePermission of userRole.role.rolePermissions) {
          permissionSet.add(rolePermission.permission.key);
        }
      }
    }

    const branchScope =
      user.isSuperAdmin || user.isTenantAdmin || user.branchScopes.length === 0
        ? {
            scopeType: BranchScopeType.ALL_BRANCHES,
            branchIds: allBranches.map((branch) => branch.id),
            branchNames: allBranches.map((branch) => branch.name),
          }
        : {
            scopeType: BranchScopeType.SELECTED,
            branchIds: user.branchScopes.map((scope) => scope.branchId),
            branchNames: user.branchScopes.map((scope) => scope.branch.name),
          };

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      tenantId: user.tenantId,
      isSuperAdmin: user.isSuperAdmin,
      isTenantAdmin: user.isTenantAdmin,
      status: user.status as UserStatus,
      effectivePermissions: [...permissionSet].sort(),
      branchScope,
    };
  }

  private async ensurePermissionCatalog(): Promise<void> {
    for (const permission of PERMISSION_CATALOG) {
      await this.prisma.permission.upsert({
        where: { key: permission.key },
        update: {
          description: permission.description,
          group: permission.group,
        },
        create: permission,
      });
    }
  }

  private async ensureTenantRoles(tenantId: string, preset: IndustryPreset): Promise<void> {
    const permissionRecords = await this.prisma.permission.findMany({
      where: {
        key: { in: getAllPermissionKeys() },
      },
    });

    const permissionMap = new Map(permissionRecords.map((permission) => [permission.key, permission.id]));

    for (const template of getDefaultRoleTemplates(preset)) {
      const role = await this.prisma.permissionRole.upsert({
        where: {
          tenantId_name: {
            tenantId,
            name: template.name,
          },
        },
        update: {
          description: template.description,
          isSystem: template.isSystem ?? false,
        },
        create: {
          tenantId,
          name: template.name,
          description: template.description,
          isSystem: template.isSystem ?? false,
        },
      });

      await this.prisma.rolePermission.deleteMany({
        where: { roleId: role.id },
      });

      const permissionIds = template.permissionKeys
        .map((key) => permissionMap.get(key))
        .filter((value): value is string => !!value);

      if (permissionIds.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  private async ensureTenantBranches(tenantId: string, preset: IndustryPreset): Promise<void> {
    const branchCount = await this.prisma.branch.count({ where: { tenantId } });
    if (branchCount > 0) {
      return;
    }

    for (const name of getDefaultBranchNames(preset)) {
      await this.prisma.branch.create({
        data: {
          tenantId,
          name,
        },
      });
    }
  }
}
