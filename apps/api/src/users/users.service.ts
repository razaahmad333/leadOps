import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
import { AccountIdentityService } from '../accounts/account-identity.service';
import { normalizePhoneNumber } from '../common/utils/phone.util';
import {
  buildBranchScopeSummary,
  normalizeBranchScopeInput,
  resolveDefaultBranchId,
  resolveRoleIds,
} from '../common/utils/user-access.util';
import { getTenantContext } from '../tenant/tenant.store';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly accountIdentity: AccountIdentityService,
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

  async create(dto: CreateUserDto, actorId?: string): Promise<TeamUser> {
    const tenantId = getTenantContext()?.tenantId ?? '';
    await this.accessControl.ensureTenantInitialized(tenantId);
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedPhone = normalizePhoneNumber(dto.phone) || null;

    const existing = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email: normalizedEmail,
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

    const account = await this.accountIdentity.findOrCreateAccount({
      email: normalizedEmail,
      phone: normalizedPhone,
      password: dto.password,
      requirePasswordForNew: true,
      rejectPhoneLinkedToDifferentEmail: true,
      missingPasswordMessage: 'Password is required for this MVP flow',
    });

    const existingMembership = await this.prisma.user.findFirst({
      where: {
        tenantId,
        accountId: account.id,
      },
      select: { id: true },
    });

    if (existingMembership) {
      throw new BadRequestException('This account already has a user in this tenant');
    }

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          tenantId,
          accountId: account.id,
          name: dto.name.trim(),
          email: normalizedEmail,
          phone: normalizedPhone,
          status: UserStatus.ACTIVE,
          isTenantAdmin: dto.isTenantAdmin ?? false,
        },
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('A user with this email or phone already exists');
      }

      throw error;
    }

    const resolvedRoleIds = resolveRoleIds(dto.roleId, dto.roleIds);
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

    const defaultBranchId = resolveDefaultBranchId(
      dto.defaultBranchId,
      normalizedBranchScope,
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

    await this.prisma.tenantAuditEvent.create({
      data: {
        tenantId,
        actorId: actorId ?? null,
        entityType: 'USER',
        entityId: user.id,
        action: 'tenant.user.created',
        metadata: {
          email: user.email,
          name: user.name,
          isTenantAdmin: user.isTenantAdmin,
        },
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

    if (id === actorId && dto.status === UserStatus.INACTIVE) {
      throw new BadRequestException('You cannot deactivate your own user');
    }

    const nextIsTenantAdmin = dto.isTenantAdmin ?? existing.isTenantAdmin;
    const normalizedBranchScope = await this.normalizeBranchScope(
      tenantId,
      dto.branchScope,
      nextIsTenantAdmin,
      existing,
    );

    const resolvedRoleIds = resolveRoleIds(dto.roleId, dto.roleIds);
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

    const defaultBranchId = resolveDefaultBranchId(
      dto.defaultBranchId === undefined ? existing.defaultBranchId : dto.defaultBranchId,
      normalizedBranchScope,
      nextIsTenantAdmin,
    );

    const normalizedPhone = dto.phone === undefined ? undefined : normalizePhoneNumber(dto.phone) || null;

    await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: normalizedPhone,
        isTenantAdmin: nextIsTenantAdmin,
        status: dto.status as UserStatus | undefined,
        role: nextLegacyRole,
        defaultBranchId,
      },
    });

    if (dto.phone !== undefined) {
      await this.syncAccountPhone(existing.accountId, normalizedPhone);
    }

    await this.prisma.tenantAuditEvent.create({
      data: {
        tenantId,
        actorId: actorId ?? null,
        entityType: 'USER',
        entityId: id,
        action: 'tenant.user.updated',
        metadata: this.extractUserUpdateMetadata(dto, normalizedPhone) as Prisma.InputJsonValue,
      },
    });

    return this.findOne(id);
  }

  async resetPassword(id: string, password: string, actorId?: string): Promise<void> {
    const tenantId = getTenantContext()?.tenantId ?? '';
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.accountIdentity.resetPassword(user.accountId, password);

    await this.prisma.tenantAuditEvent.create({
      data: {
        tenantId,
        actorId: actorId ?? null,
        entityType: 'USER',
        entityId: id,
        action: 'tenant.user.password_reset',
      },
    });
  }

  private async syncAccountPhone(accountId: string, phone: string | null | undefined): Promise<void> {
    if (phone === undefined) {
      return;
    }

    const existing = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!existing) {
      throw new NotFoundException('Account not found');
    }

    if (phone && existing.phone && existing.phone !== phone) {
      const conflicting = await this.prisma.account.findUnique({
        where: { phone },
      });

      if (conflicting && conflicting.id !== accountId) {
        throw new BadRequestException('This mobile number is already used by another account');
      }
    }

    await this.prisma.account.update({
      where: { id: accountId },
      data: { phone },
    });

    await this.prisma.user.updateMany({
      where: { accountId },
      data: { phone },
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
    const normalized = normalizeBranchScopeInput({
      input,
      existingBranchIds: existing?.branchScopes?.map((scope) => scope.branchId),
      forceAllBranches: isTenantAdmin,
    });

    if (normalized.scopeType === BranchScopeType.SELECTED) {
      await this.ensureActiveBranchesExist(tenantId, normalized.branchIds);
    }

    return normalized;
  }

  private async ensureActiveBranchesExist(tenantId: string, branchIds: string[]): Promise<void> {
    const activeBranches = await this.prisma.branch.findMany({
      where: {
        tenantId,
        id: { in: branchIds },
        isActive: true,
      },
      select: { id: true },
    });

    if (activeBranches.length !== branchIds.length) {
      throw new BadRequestException('One or more selected branches are invalid');
    }
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
      branchScope: buildBranchScopeSummary({
        forceAllBranches: user.isTenantAdmin,
        assignedBranches: user.branchScopes,
        allBranches,
      }),
      defaultBranchId: user.defaultBranchId,
    };
  }

  private extractUserUpdateMetadata(
    dto: UpdateUserDto,
    normalizedPhone: string | null | undefined,
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      metadata.name = dto.name.trim();
    }

    if (dto.phone !== undefined) {
      metadata.phone = normalizedPhone;
    }

    if (dto.status !== undefined) {
      metadata.status = dto.status;
    }

    if (dto.isTenantAdmin !== undefined) {
      metadata.isTenantAdmin = dto.isTenantAdmin;
    }

    if (dto.defaultBranchId !== undefined) {
      metadata.defaultBranchId = dto.defaultBranchId;
    }

    if (dto.branchScope !== undefined) {
      metadata.branchScope = dto.branchScope;
    }

    if (dto.roleId !== undefined || dto.roleIds !== undefined) {
      metadata.roleIds = dto.roleIds ?? (dto.roleId ? [dto.roleId] : []);
    }

    return metadata;
  }
}
