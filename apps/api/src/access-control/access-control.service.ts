import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AuthUser,
  BranchScopeType,
  IndustryPreset,
  PermissionGroup,
  Role,
  UserStatus,
} from '@leadops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { buildBranchScopeSummary } from '../common/utils/user-access.util';
import { getTenantContext } from '../tenant/tenant.store';
import { AuthUserCacheService } from './auth-user-cache.service';
import {
  getAdminRoleName,
  getAllPermissionKeys,
  getDefaultRoleTemplates,
  getLegacyRoleTemplateName,
  PERMISSION_CATALOG,
} from './permission-catalog';

interface BuildAuthUserOptions {
  includeAvailableTenants?: boolean;
}

@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);
  private readonly requestAuthUserCache = new Map<string, Promise<AuthUser>>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly sharedAuthUserCache?: AuthUserCacheService,
  ) {}

  async buildAuthUser(
    userId: string,
    tenantId?: string,
    requestId?: string,
    options?: BuildAuthUserOptions,
  ): Promise<AuthUser> {
    const activeTenantId = tenantId ?? getTenantContext(false)?.tenantId;
    if (!activeTenantId || activeTenantId === 'system') {
      throw new ForbiddenException('Tenant context missing for permission resolution');
    }

    const includeAvailableTenants = options?.includeAvailableTenants === true;
    const activeRequestId = requestId ?? getTenantContext(false)?.requestId;
    if (!activeRequestId) {
      return this.resolveWithSharedAuthCache({
        userId,
        tenantId: activeTenantId,
        includeAvailableTenants,
      });
    }

    const requestCacheKey = `${activeRequestId}:${activeTenantId}:${userId}:${includeAvailableTenants ? 'full' : 'slim'}`;
    const cached = this.requestAuthUserCache.get(requestCacheKey);
    if (cached) {
      return cached;
    }

    const next = this.resolveWithSharedAuthCache({
      userId,
      tenantId: activeTenantId,
      includeAvailableTenants,
      requestId: activeRequestId,
    });
    this.requestAuthUserCache.set(requestCacheKey, next);

    if (this.requestAuthUserCache.size > 500) {
      this.requestAuthUserCache.clear();
    }

    return next;
  }

  async invalidateTenantMembership(userId: string, tenantId: string): Promise<void> {
    await this.invalidateMembershipCacheEntries([{ userId, tenantId }]);
  }

  async invalidateAccountMemberships(accountId: string): Promise<void> {
    const memberships = await this.prisma.user.findMany({
      where: { accountId },
      select: {
        id: true,
        tenantId: true,
      },
    });

    await this.invalidateMembershipCacheEntries(
      memberships.map((membership) => ({
        userId: membership.id,
        tenantId: membership.tenantId,
      })),
    );
  }

  async invalidateUsersAssignedToRole(roleId: string): Promise<void> {
    const users = await this.prisma.userRole.findMany({
      where: { roleId },
      include: {
        user: {
          select: {
            id: true,
            tenantId: true,
          },
        },
      },
    });

    await this.invalidateMembershipCacheEntries(
      users.map((entry) => ({
        userId: entry.user.id,
        tenantId: entry.user.tenantId,
      })),
    );
  }

  async invalidateTenantUsers(tenantId: string): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
      },
    });

    await this.invalidateMembershipCacheEntries(
      users.map((user) => ({
        userId: user.id,
        tenantId,
      })),
    );
  }

  async listPermissionGroups(): Promise<PermissionGroup[]> {
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

  async provisionPermissionCatalog(): Promise<void> {
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

  async provisionTenantRbac(tenantId: string, preset?: IndustryPreset): Promise<void> {
    const activePreset = preset ?? (await this.resolveTenantPresetForRbac(tenantId));

    await this.provisionPermissionCatalog();
    await this.provisionTenantRoles(tenantId, activePreset);
  }

  async validateTenantRbacBaseline(tenantId: string, preset?: IndustryPreset): Promise<void> {
    const activePreset = preset ?? (await this.resolveTenantPresetForRbac(tenantId));
    const missingRoleNames = await this.resolveMissingSystemRoleNames(tenantId, activePreset);
    if (missingRoleNames.length > 0) {
      throw new ForbiddenException(
        `Tenant RBAC baseline missing required system roles: ${missingRoleNames.join(', ')}`,
      );
    }
  }

  async validateStartupRbacBaseline(): Promise<void> {
    const permissionCount = await this.prisma.permission.count();
    const errors: string[] = [];

    if (permissionCount <= 0) {
      errors.push('permission catalog is empty');
    }

    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
        slug: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const tenant of tenants) {
      try {
        await this.validateTenantRbacBaseline(tenant.id);
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        errors.push(`tenant ${tenant.slug} (${tenant.id}): ${reason}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `RBAC baseline validation failed.\n- ${errors.join('\n- ')}\nRun: pnpm --filter @leadops/api rbac:bootstrap`,
      );
    }
  }

  async listTenantBranches(tenantId: string, options?: { includeInactive?: boolean }) {
    return this.prisma.branch.findMany({
      where: {
        tenantId,
        ...(options?.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async getTenantAdminRole(tenantId: string, preset?: IndustryPreset) {
    const activePreset = preset ?? (await this.resolveTenantPresetForRbac(tenantId));

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
    const activePreset = preset ?? (await this.resolveTenantPresetForRbac(tenantId));
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
      if (!adminRole) {
        throw new ForbiddenException(
          `Tenant RBAC baseline missing required system role: ${getAdminRoleName(activePreset)}`,
        );
      }

      nextRoleIds.add(adminRole.id);
    }

    if (!isTenantAdmin && nextRoleIds.size === 0) {
      throw new BadRequestException('At least one role must be assigned for non-admin users');
    }

    await this.prisma.userRole.deleteMany({ where: { userId } });

    if (nextRoleIds.size > 0) {
      await this.prisma.userRole.createMany({
        data: [...nextRoleIds].map((roleId) => ({ userId, roleId })),
        skipDuplicates: true,
      });
    }

    await this.invalidateTenantMembership(userId, tenantId);
  }

  async resolveDefaultRoleIdsForUser(
    tenantId: string,
    options: {
      legacyRole: Role;
      isTenantAdmin: boolean;
      preset?: IndustryPreset;
    },
  ): Promise<string[]> {
    if (options.isTenantAdmin) {
      return [];
    }

    const activePreset = options.preset ?? (await this.resolveTenantPresetForRbac(tenantId));
    const preferredRoleName = getLegacyRoleTemplateName(
      activePreset,
      options.legacyRole === Role.OWNER ? Role.OWNER : Role.STAFF,
    );

    const role = await this.prisma.permissionRole.findUnique({
      where: {
        tenantId_name: {
          tenantId,
          name: preferredRoleName,
        },
      },
      select: { id: true },
    });

    if (!role) {
      throw new ForbiddenException(
        `Tenant RBAC baseline missing default role: ${preferredRoleName}`,
      );
    }

    return [role.id];
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
      await this.invalidateTenantMembership(userId, tenantId);
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
              isActive: true,
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

    await this.invalidateTenantMembership(userId, tenantId);
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

  private async buildAuthUserFresh(
    userId: string,
    tenantId: string,
    options?: BuildAuthUserOptions,
  ): Promise<AuthUser> {
    const includeAvailableTenants = options?.includeAvailableTenants === true;
    const [allBranches, user] = await Promise.all([
      this.prisma.branch.findMany({
        where: { tenantId, isActive: true },
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

    if (!user.isSuperAdmin && !user.isTenantAdmin && user.userRoles.length === 0) {
      throw new ForbiddenException(
        'User has no assigned roles. Contact your platform administrator.',
      );
    }

    const memberships = includeAvailableTenants
      ? await this.prisma.user.findMany({
          where: {
            accountId: user.accountId,
            status: UserStatus.ACTIVE,
          },
          include: {
            tenant: true,
          },
          orderBy: [{ tenant: { name: 'asc' } }, { createdAt: 'asc' }],
        })
      : [];

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

    const branchScope = buildBranchScopeSummary({
      forceAllBranches: user.isSuperAdmin || user.isTenantAdmin,
      assignedBranches: user.branchScopes,
      allBranches,
    });

    return {
      id: user.id,
      accountId: user.accountId,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      tenantId: user.tenantId,
      defaultBranchId: user.defaultBranchId,
      isSuperAdmin: user.isSuperAdmin,
      isTenantAdmin: user.isTenantAdmin,
      status: user.status as UserStatus,
      effectivePermissions: [...permissionSet].sort(),
      availableTenants: memberships.map((membership) => ({
        tenantId: membership.tenantId,
        tenantName: membership.tenant.name,
        tenantSlug: membership.tenant.slug,
        userId: membership.id,
        role: membership.role as Role,
        isSuperAdmin: membership.isSuperAdmin,
        isTenantAdmin: membership.isTenantAdmin,
      })),
      branchScope,
    };
  }

  private async resolveWithSharedAuthCache(input: {
    userId: string;
    tenantId: string;
    includeAvailableTenants: boolean;
    requestId?: string;
  }): Promise<AuthUser> {
    if (!this.sharedAuthUserCache) {
      return this.buildAuthUserFresh(input.userId, input.tenantId, {
        includeAvailableTenants: input.includeAvailableTenants,
      });
    }

    const cacheKey = this.sharedAuthUserCache.buildCacheKey(
      input.tenantId,
      input.userId,
      input.includeAvailableTenants,
    );
    const outcome = await this.sharedAuthUserCache.getOrLoad(cacheKey, () =>
      this.buildAuthUserFresh(input.userId, input.tenantId, {
        includeAvailableTenants: input.includeAvailableTenants,
      }),
    );

    this.logger.debug(
      `[auth-cache] requestId=${input.requestId ?? 'n/a'} source=${outcome.source} hit=${outcome.stats.hit} miss=${outcome.stats.miss} l1=${outcome.stats.l1} l2=${outcome.stats.l2} db=${outcome.stats.db} singleflight=${outcome.stats.singleflight} error=${outcome.stats.error}`,
    );

    return outcome.value;
  }

  private async invalidateMembershipCacheEntries(entries: Array<{ userId: string; tenantId: string }>): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    this.requestAuthUserCache.clear();

    if (!this.sharedAuthUserCache) {
      return;
    }

    const keys = new Set<string>();
    for (const entry of entries) {
      for (const key of this.sharedAuthUserCache.membershipKeys(entry.tenantId, entry.userId)) {
        keys.add(key);
      }
    }

    await this.sharedAuthUserCache.invalidateKeys([...keys]);
  }

  private async provisionTenantRoles(tenantId: string, preset: IndustryPreset): Promise<void> {
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

  private async resolveTenantPresetForRbac(tenantId: string): Promise<IndustryPreset> {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { industryPreset: true },
    });

    if (!config) {
      throw new ForbiddenException('Tenant configuration missing for RBAC resolution');
    }

    return this.parseIndustryPreset(config.industryPreset);
  }

  private async resolveMissingSystemRoleNames(
    tenantId: string,
    preset: IndustryPreset,
  ): Promise<string[]> {
    const requiredNames = getDefaultRoleTemplates(preset)
      .filter((template) => template.isSystem)
      .map((template) => template.name);

    if (requiredNames.length === 0) {
      return [];
    }

    const existing = await this.prisma.permissionRole.findMany({
      where: {
        tenantId,
        isSystem: true,
        name: { in: requiredNames },
      },
      select: { name: true },
    });

    const existingNames = new Set(existing.map((role) => role.name));
    return requiredNames.filter((name) => !existingNames.has(name));
  }

  private parseIndustryPreset(value: string): IndustryPreset {
    return (Object.values(IndustryPreset) as string[]).includes(value)
      ? (value as IndustryPreset)
      : IndustryPreset.GENERIC;
  }
}
