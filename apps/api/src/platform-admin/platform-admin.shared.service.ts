import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BranchScopeInput,
  BranchScopeType,
  CreatePlatformMembershipDto,
  IndustryPreset,
  PlatformAdminUserSummary,
  PlatformMembershipSummary,
  PlatformPageMeta,
  PlatformTenantDetails,
  PlatformTenantRole,
  PlatformTenantSummary,
  Role,
  UserStatus,
} from '@leadops/shared';
import { Prisma } from '@prisma/client';
import { AccessControlService } from '../access-control/access-control.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountIdentityService } from '../accounts/account-identity.service';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { DEFAULT_TENANT_TIMEZONE } from '../tenant/tenant-defaults';
import { getPresetDisplayConfig } from '../tenant/tenant-presets';
import { normalizePhoneNumber } from '../common/utils/phone.util';
import { buildPageMeta } from '../common/utils/pagination.util';
import {
  buildBranchScopeSummary,
  normalizeBranchScopeInput,
} from '../common/utils/user-access.util';

type TenantUserRecord = {
  id: string;
  accountId: string;
  name: string;
  role: string;
  status: string;
  isTenantAdmin: boolean;
  isSuperAdmin: boolean;
  defaultBranchId: string | null;
  branchScopes: Array<{
    branchId: string;
    branch: {
      id: string;
      name: string;
    };
  }>;
  userRoles: Array<{
    role: {
      id: string;
      name: string;
      isSystem: boolean;
    };
  }>;
  createdAt: Date;
  updatedAt: Date;
  account: { email: string; phone: string | null };
};

type TenantAuditEventRecord = {
  id: string;
  tenantId: string;
  actorId: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  metadata: unknown;
  createdAt: Date;
  actor: { name: string; email: string } | null;
};

@Injectable()
export class PlatformAdminSharedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly accountIdentity: AccountIdentityService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  ensureSuperAdmin(actor: { isSuperAdmin: boolean }): void {
    if (!actor.isSuperAdmin) {
      throw new ForbiddenException('SUPER_ADMIN access required');
    }
  }

  resolveTenantOrderBy(
    sortBy: 'createdAt' | 'name' | 'userCount',
    sortOrder: 'asc' | 'desc',
  ): Prisma.TenantOrderByWithRelationInput[] {
    if (sortBy === 'name') {
      return [{ name: sortOrder }, { createdAt: 'desc' }];
    }

    if (sortBy === 'userCount') {
      return [{ users: { _count: sortOrder } }, { createdAt: 'desc' }];
    }

    return [{ createdAt: sortOrder }];
  }

  async ensureTenantExists(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
  }

  async resolvePermissionIds(permissionKeys: string[]): Promise<string[]> {
    const permissions = await this.prisma.permission.findMany({
      where: {
        key: { in: permissionKeys },
      },
      select: { id: true, key: true },
    });

    if (permissions.length !== permissionKeys.length) {
      throw new BadRequestException('One or more permission keys are invalid');
    }

    return permissions.map((permission) => permission.id);
  }

  normalizeDescription(value: string | undefined): string | null {
    if (value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  async normalizePlatformUserBranchScope(
    tenantId: string,
    input: BranchScopeInput | undefined,
    isAllBranchesUser: boolean,
    existingBranchIds: string[],
  ): Promise<BranchScopeInput> {
    const normalized = normalizeBranchScopeInput({
      input,
      existingBranchIds,
      forceAllBranches: isAllBranchesUser,
    });

    if (normalized.scopeType === BranchScopeType.SELECTED) {
      await this.ensureActiveBranchesExist(tenantId, normalized.branchIds);
    }

    return normalized;
  }

  async ensurePlatformLastOwnerProtection(
    existing: { id: string; tenantId: string; role: Role },
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

  async getAllTenantUsers(tenantId: string): Promise<{
    items: TenantUserRecord[];
    pageMeta?: PlatformPageMeta;
  }> {
    const items = await this.prisma.user.findMany({
      where: { tenantId },
      include: {
        account: {
          select: {
            email: true,
            phone: true,
          },
        },
        branchScopes: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { branch: { name: 'asc' } },
        },
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                isSystem: true,
              },
            },
          },
          orderBy: { role: { name: 'asc' } },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return { items };
  }

  async getPaginatedTenantUsers(
    tenantId: string,
    page: number,
    pageSize: number,
  ): Promise<{
    items: TenantUserRecord[];
    pageMeta: PlatformPageMeta;
  }> {
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.user.findMany({
        where: { tenantId },
        include: {
          account: {
            select: {
              email: true,
              phone: true,
            },
          },
          branchScopes: {
            include: {
              branch: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { branch: { name: 'asc' } },
          },
          userRoles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  isSystem: true,
                },
              },
            },
            orderBy: { role: { name: 'asc' } },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items,
      pageMeta: buildPageMeta(page, pageSize, total),
    };
  }

  async getAllTenantAuditEvents(tenantId: string): Promise<{
    items: TenantAuditEventRecord[];
    pageMeta?: PlatformPageMeta;
  }> {
    const items = await this.prisma.tenantAuditEvent.findMany({
      where: { tenantId },
      include: {
        actor: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return { items };
  }

  async getPaginatedTenantAuditEvents(
    tenantId: string,
    page: number,
    pageSize: number,
  ): Promise<{
    items: TenantAuditEventRecord[];
    pageMeta: PlatformPageMeta;
  }> {
    const [total, items] = await Promise.all([
      this.prisma.tenantAuditEvent.count({ where: { tenantId } }),
      this.prisma.tenantAuditEvent.findMany({
        where: { tenantId },
        include: {
          actor: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items,
      pageMeta: buildPageMeta(page, pageSize, total),
    };
  }

  mapTenantSummary(tenant: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    config: { industryPreset: string } | null;
    _count: { users: number };
  }): PlatformTenantSummary {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      industryPreset: this.parseIndustryPreset(tenant.config?.industryPreset),
      userCount: tenant._count.users,
      createdAt: tenant.createdAt.toISOString(),
    };
  }

  private parseIndustryPreset(value: string | null | undefined): IndustryPreset {
    switch (value) {
      case IndustryPreset.DIAGNOSTICS_LAB:
      case 'COSMETIC_CLINIC':
      case 'DENTAL_CLINIC':
      case 'DOCTOR_OPD_CLINIC':
        return value as IndustryPreset;
      case IndustryPreset.GENERIC:
      default:
        return IndustryPreset.GENERIC;
    }
  }

  mapPlatformTenantRole(role: {
    id: string;
    tenantId: string | null;
    name: string;
    description: string | null;
    isSystem: boolean;
    rolePermissions: Array<{
      permission: {
        key: string;
      };
    }>;
    _count: {
      userRoles: number;
    };
  }): PlatformTenantRole {
    return {
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissionKeys: role.rolePermissions.map((entry) => entry.permission.key).sort(),
      userCount: role._count.userRoles,
    };
  }

  mapTenantUserDetail(
    user: TenantUserRecord,
    allActiveBranches: Array<{ id: string; name: string }>,
  ): PlatformTenantDetails['users'][number] {
    const roles = user.userRoles.map((entry) => ({
      id: entry.role.id,
      name: entry.role.name,
      isSystem: entry.role.isSystem,
    }));
    const branchScope = buildBranchScopeSummary({
      forceAllBranches: user.isTenantAdmin || user.isSuperAdmin,
      assignedBranches: user.branchScopes,
      allBranches: allActiveBranches,
    });

    return {
      id: user.id,
      accountId: user.accountId,
      name: user.name,
      email: user.account.email,
      phone: user.account.phone,
      role: user.role as Role,
      roles,
      roleNames: roles.map((role) => role.name),
      status: user.status as UserStatus,
      isTenantAdmin: user.isTenantAdmin,
      isSuperAdmin: user.isSuperAdmin,
      branchScope,
      defaultBranchId: user.defaultBranchId,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  mapTenantAuditEvent(event: TenantAuditEventRecord): PlatformTenantDetails['auditEvents'][number] {
    return {
      id: event.id,
      tenantId: event.tenantId,
      actorId: event.actorId,
      actorName: event.actor?.name ?? event.actor?.email ?? null,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      metadata: event.metadata ?? null,
      createdAt: event.createdAt.toISOString(),
    };
  }

  async createTenantConfig(tenantId: string, preset: IndustryPreset): Promise<void> {
    const displayConfig = getPresetDisplayConfig(preset);

    await this.prisma.tenantConfig.create({
      data: {
        tenantId,
        industryPreset: preset,
        configVersion: 1,
        displayConfig,
        timezone: DEFAULT_TENANT_TIMEZONE,
        businessStart: '09:00',
        businessEnd: '18:00',
        stages: displayConfig.pipelineConfig.stages.map((stage) => stage.label),
        reminderRules: {
          defaultLeadFollowupMinutes: displayConfig.followupRules.defaultLeadFollowupMinutes,
          firstReminderMinutes: displayConfig.followupRules.firstReminderMinutes,
          escalationMinutes: displayConfig.followupRules.escalationMinutes,
          postReportFollowupDays: displayConfig.followupRules.postReportFollowupDays,
        },
        templates: [],
        featureFlags: displayConfig.featureFlags,
      },
    });
  }

  async createMembershipRecord(
    input: CreatePlatformMembershipDto & { tenantId: string },
    actorId?: string,
  ): Promise<{
    id: string;
    tenantId: string;
    tenant: { name: string; slug: string };
    role: string;
    isTenantAdmin: boolean;
    isSuperAdmin: boolean;
    status: string;
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });

    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    await this.accessControl.ensureTenantInitialized(input.tenantId);

    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedPhone = normalizePhoneNumber(input.phone) || null;
    const account = await this.accountIdentity.findOrCreateAccount({
      email: normalizedEmail,
      phone: normalizedPhone,
      password: input.password,
      requirePasswordForNew: true,
      rejectPhoneLinkedToDifferentEmail: true,
    });

    const existingMembership = await this.prisma.user.findFirst({
      where: {
        tenantId: input.tenantId,
        accountId: account.id,
      },
    });

    if (existingMembership) {
      throw new BadRequestException('This account already has access to the selected tenant');
    }

    const role = input.isTenantAdmin ? Role.OWNER : Role.STAFF;
    const user = await this.prisma.user.create({
      data: {
        tenantId: input.tenantId,
        accountId: account.id,
        email: account.email,
        name: input.name.trim(),
        phone: account.phone,
        role,
        status: UserStatus.ACTIVE,
        isTenantAdmin: input.isTenantAdmin ?? false,
      },
      include: {
        tenant: true,
      },
    });

    await this.accessControl.setUserRoles(
      user.id,
      input.tenantId,
      [],
      input.isTenantAdmin ?? false,
    );
    await this.accessControl.setUserBranchScope(user.id, input.tenantId, {
      scopeType: BranchScopeType.ALL_BRANCHES,
      branchIds: [],
    });
    await this.accessControl.ensureLegacyAssignment({
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      isTenantAdmin: user.isTenantAdmin,
    });

    await this.prisma.tenantAuditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorId: actorId ?? null,
        entityType: 'USER',
        entityId: user.id,
        action: 'platform.user.created',
        metadata: {
          name: user.name,
          email: user.email,
          isTenantAdmin: user.isTenantAdmin,
        },
      },
    });

    return user;
  }

  async validateAccountIdentityForMembership(email: string, phone: string | null): Promise<void> {
    const emailAccount = await this.prisma.account.findUnique({
      where: { email },
    });
    const phoneAccount = phone
      ? await this.prisma.account.findUnique({
          where: { phone },
        })
      : null;

    if (emailAccount && phoneAccount && emailAccount.id !== phoneAccount.id) {
      throw new BadRequestException('Email and mobile number belong to different accounts');
    }

    const account = emailAccount ?? phoneAccount;
    if (!account) {
      return;
    }

    if (!emailAccount && account.email !== email) {
      throw new BadRequestException('This mobile number is already linked to a different email');
    }

    if (phone && account.phone && account.phone !== phone) {
      throw new BadRequestException('This email is already linked to a different mobile number');
    }
  }

  mapMembershipSummary(user: {
    id: string;
    tenantId: string;
    tenant: { name: string; slug: string };
    role: string;
    isTenantAdmin: boolean;
    isSuperAdmin: boolean;
    status: string;
  }): PlatformMembershipSummary {
    return {
      userId: user.id,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      tenantSlug: user.tenant.slug,
      role: user.role as Role,
      isTenantAdmin: user.isTenantAdmin,
      isSuperAdmin: user.isSuperAdmin,
      status: user.status as UserStatus,
    };
  }

  async getPlatformAdminUserSummary(userId: string): Promise<PlatformAdminUserSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        account: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapPlatformAdminUserSummary({
      userId: user.id,
      accountId: user.accountId,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      tenantSlug: user.tenant.slug,
      name: user.name,
      email: user.account.email,
      phone: user.account.phone,
      role: user.role,
      isTenantAdmin: user.isTenantAdmin,
      isSuperAdmin: user.isSuperAdmin,
      status: user.status,
      accountStatus: user.account.status,
    });
  }

  mapPlatformAdminUserSummary(input: {
    userId: string;
    accountId: string;
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    isTenantAdmin: boolean;
    isSuperAdmin: boolean;
    status: string;
    accountStatus: string;
  }): PlatformAdminUserSummary {
    return {
      userId: input.userId,
      accountId: input.accountId,
      tenantId: input.tenantId,
      tenantName: input.tenantName,
      tenantSlug: input.tenantSlug,
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role as Role,
      isTenantAdmin: input.isTenantAdmin,
      isSuperAdmin: input.isSuperAdmin,
      status: input.status as UserStatus,
      accountStatus: input.accountStatus as UserStatus,
    };
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
}
