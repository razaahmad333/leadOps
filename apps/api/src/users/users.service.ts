import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  BranchScopeInput,
  BranchScopeType,
  CreateUserDto,
  Role,
  TeamUser,
  UpdateUserDto,
  UserStatus,
} from '@leadops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { normalizePhoneNumber } from '../common/utils/phone.util';
import { getTenantContext } from '../tenant/tenant.store';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  async findAll(): Promise<TeamUser[]> {
    const tenantId = getTenantContext()?.tenantId ?? '';
    await this.accessControl.ensureTenantInitialized(tenantId);

    const basics = await this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        tenantId: true,
        role: true,
        isTenantAdmin: true,
      },
    });

    for (const user of basics) {
      await this.accessControl.ensureLegacyAssignment(user);
    }

    const users = await this.prisma.user.findMany({
      where: { tenantId },
      include: {
        branchScopes: {
          include: { branch: true },
          orderBy: { branch: { name: 'asc' } },
        },
        userRoles: {
          include: {
            role: true,
          },
          orderBy: { role: { name: 'asc' } },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const allBranches = await this.accessControl.listTenantBranches(tenantId);

    return users.map((user) => this.mapTeamUser(user, allBranches));
  }

  async create(dto: CreateUserDto): Promise<TeamUser> {
    const tenantId = getTenantContext()?.tenantId ?? '';
    await this.accessControl.ensureTenantInitialized(tenantId);

    const existing = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email: dto.email,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    if (!dto.password) {
      throw new BadRequestException('Password is required for this MVP flow');
    }

    const normalizedBranchScope = await this.normalizeBranchScope(
      tenantId,
      dto.branchScope,
      dto.isTenantAdmin ?? false,
    );

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: normalizePhoneNumber(dto.phone) || null,
        passwordHash,
        status: UserStatus.ACTIVE,
        isTenantAdmin: dto.isTenantAdmin ?? false,
      },
    });

    const resolvedRoleIds = this.resolveRoleIds(dto.roleId, dto.roleIds);
    await this.accessControl.setUserRoles(
      user.id,
      tenantId,
      resolvedRoleIds,
      dto.isTenantAdmin ?? false,
    );
    await this.accessControl.setUserBranchScope(user.id, tenantId, normalizedBranchScope);

    const assignedRoles = await this.prisma.permissionRole.findMany({
      where: {
        userRoles: {
          some: {
            userId: user.id,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const defaultBranchId = this.resolveDefaultBranchId(
      dto.defaultBranchId,
      normalizedBranchScope,
      assignedRoles,
      dto.isTenantAdmin ?? false,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        role: this.accessControl.determineLegacyRole({
          isTenantAdmin: dto.isTenantAdmin ?? false,
          roles: assignedRoles,
        }),
        defaultBranchId,
      },
    });

    return this.findOne(user.id);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string): Promise<TeamUser> {
    const tenantId = getTenantContext()?.tenantId ?? '';
    await this.accessControl.ensureTenantInitialized(tenantId);

    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId },
      include: {
        branchScopes: true,
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (existing.isSuperAdmin && existing.id !== actorId) {
      throw new ForbiddenException('SUPER_ADMIN users must be managed separately');
    }

    const nextIsTenantAdmin = dto.isTenantAdmin ?? existing.isTenantAdmin;
    const normalizedBranchScope = await this.normalizeBranchScope(
      tenantId,
      dto.branchScope,
      nextIsTenantAdmin,
      existing,
    );

    const resolvedRoleIds = this.resolveRoleIds(dto.roleId, dto.roleIds);
    if (dto.roleId !== undefined || dto.roleIds !== undefined || dto.isTenantAdmin !== undefined) {
      await this.accessControl.setUserRoles(id, tenantId, resolvedRoleIds, nextIsTenantAdmin);
    }

    if (dto.branchScope) {
      await this.accessControl.setUserBranchScope(id, tenantId, normalizedBranchScope);
    } else if (dto.isTenantAdmin === true) {
      await this.accessControl.setUserBranchScope(id, tenantId, {
        scopeType: BranchScopeType.ALL_BRANCHES,
        branchIds: [],
      });
    }

    const assignedRoles = await this.prisma.permissionRole.findMany({
      where: {
        userRoles: {
          some: {
            userId: id,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const nextLegacyRole = this.accessControl.determineLegacyRole({
      isSuperAdmin: existing.isSuperAdmin,
      isTenantAdmin: nextIsTenantAdmin,
      roles: assignedRoles,
    });

    await this.ensureLastOwnerProtection(existing, nextLegacyRole);

    const defaultBranchId = this.resolveDefaultBranchId(
      dto.defaultBranchId === undefined ? existing.defaultBranchId : dto.defaultBranchId,
      normalizedBranchScope,
      assignedRoles,
      nextIsTenantAdmin,
    );

    await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone === undefined ? undefined : normalizePhoneNumber(dto.phone) || null,
        isTenantAdmin: nextIsTenantAdmin,
        status: dto.status as UserStatus | undefined,
        role: nextLegacyRole,
        defaultBranchId,
      },
    });

    return this.findOne(id);
  }

  async resetPassword(id: string, password: string): Promise<void> {
    const tenantId = getTenantContext()?.tenantId ?? '';
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async findOne(id: string): Promise<TeamUser> {
    const tenantId = getTenantContext()?.tenantId ?? '';
    const basicUser = await this.prisma.user.findFirst({
      where: { id, tenantId },
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

    await this.accessControl.ensureLegacyAssignment(basicUser);

    const [allBranches, user] = await Promise.all([
      this.accessControl.listTenantBranches(tenantId),
      this.prisma.user.findFirst({
        where: { id, tenantId },
        include: {
          branchScopes: {
            include: { branch: true },
            orderBy: { branch: { name: 'asc' } },
          },
          userRoles: {
            include: { role: true },
            orderBy: { role: { name: 'asc' } },
          },
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapTeamUser(user, allBranches);
  }

  private async normalizeBranchScope(
    tenantId: string,
    input: BranchScopeInput | undefined,
    isTenantAdmin: boolean,
    existing?: { branchScopes?: Array<{ branchId: string }> },
  ): Promise<BranchScopeInput> {
    if (isTenantAdmin) {
      return {
        scopeType: BranchScopeType.ALL_BRANCHES,
        branchIds: [],
      };
    }

    if (!input) {
      if (existing?.branchScopes && existing.branchScopes.length > 0) {
        return {
          scopeType: BranchScopeType.SELECTED,
          branchIds: existing.branchScopes.map((scope) => scope.branchId),
        };
      }

      return {
        scopeType: BranchScopeType.ALL_BRANCHES,
        branchIds: [],
      };
    }

    if (input.scopeType === BranchScopeType.ALL_BRANCHES) {
      return {
        scopeType: BranchScopeType.ALL_BRANCHES,
        branchIds: [],
      };
    }

    const uniqueBranchIds = [...new Set(input.branchIds)];
    if (uniqueBranchIds.length === 0) {
      throw new BadRequestException('Select at least one branch for a scoped user');
    }

    const branches = await this.prisma.branch.findMany({
      where: {
        tenantId,
        id: { in: uniqueBranchIds },
      },
    });

    if (branches.length !== uniqueBranchIds.length) {
      throw new BadRequestException('One or more selected branches are invalid');
    }

    return {
      scopeType: BranchScopeType.SELECTED,
      branchIds: uniqueBranchIds,
    };
  }

  private resolveDefaultBranchId(
    candidate: string | null | undefined,
    branchScope: BranchScopeInput,
    assignedRoles: Array<{ name: string }>,
    isTenantAdmin: boolean,
  ): string | null {
    if (isTenantAdmin) {
      return null;
    }

    if (branchScope.scopeType === BranchScopeType.ALL_BRANCHES) {
      return candidate ?? null;
    }

    if (candidate && branchScope.branchIds.includes(candidate)) {
      return candidate;
    }

    if (assignedRoles.length === 0) {
      return branchScope.branchIds[0] ?? null;
    }

    return branchScope.branchIds[0] ?? null;
  }

  private resolveRoleIds(roleId: string | null | undefined, roleIds: string[] | undefined): string[] {
    if (roleIds && roleIds.length > 0) {
      return roleIds;
    }

    if (roleId) {
      return [roleId];
    }

    return [];
  }

  private async ensureLastOwnerProtection(
    existing: { id: string; tenantId: string; role: string },
    nextLegacyRole: Role,
  ): Promise<void> {
    if (existing.role !== Role.OWNER || nextLegacyRole === Role.OWNER) {
      return;
    }

    const owners = await this.prisma.user.count({
      where: {
        tenantId: existing.tenantId,
        role: Role.OWNER,
      },
    });

    if (owners <= 1) {
      throw new BadRequestException('At least one OWNER-equivalent user must remain in the tenant');
    }
  }

  private mapTeamUser(
    user: {
      id: string;
      tenantId: string;
      email: string;
      name: string;
      phone: string | null;
      role: string;
      status: string;
      isTenantAdmin: boolean;
      isSuperAdmin: boolean;
      defaultBranchId: string | null;
      branchScopes: Array<{ branchId: string; branch: { name: string } }>;
      userRoles: Array<{ role: { id: string; name: string; isSystem: boolean } }>;
    },
    allBranches: Array<{ id: string; name: string }>,
  ): TeamUser {
    const roles = user.userRoles.map((entry) => ({
      id: entry.role.id,
      name: entry.role.name,
      isSystem: entry.role.isSystem,
    }));

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      phone: user.phone,
      legacyRole: user.role as Role,
      status: user.status as UserStatus,
      isTenantAdmin: user.isTenantAdmin,
      isSuperAdmin: user.isSuperAdmin,
      roles,
      roleNames: roles.map((role) => role.name),
      branchScope:
        user.isTenantAdmin || user.branchScopes.length === 0
          ? {
              scopeType: BranchScopeType.ALL_BRANCHES,
              branchIds: allBranches.map((branch) => branch.id),
              branchNames: allBranches.map((branch) => branch.name),
            }
          : {
              scopeType: BranchScopeType.SELECTED,
              branchIds: user.branchScopes.map((scope) => scope.branchId),
              branchNames: user.branchScopes.map((scope) => scope.branch.name),
            },
      defaultBranchId: user.defaultBranchId,
    };
  }
}
