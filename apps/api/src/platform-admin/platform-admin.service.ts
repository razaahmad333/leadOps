import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BranchScopeType,
  CreatePlatformMembershipDto,
  CreateTenantDto,
  IndustryPreset,
  PlatformAdminOverview,
  PlatformAdminUserSummary,
  PlatformMembershipSummary,
  PlatformTenantSummary,
  Role,
  UpdatePlatformUserDto,
  UserStatus,
} from '@leadops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { AccountIdentityService } from '../accounts/account-identity.service';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { getPresetDisplayConfig } from '../tenant/tenant-presets';
import { normalizePhoneNumber } from '../common/utils/phone.util';

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly accountIdentity: AccountIdentityService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async getOverview(actor: { isSuperAdmin: boolean }): Promise<PlatformAdminOverview> {
    this.ensureSuperAdmin(actor);

    const [tenants, accounts] = await Promise.all([
      this.prisma.tenant.findMany({
        include: {
          config: true,
          _count: {
            select: {
              users: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }],
      }),
      this.prisma.account.findMany({
        include: {
          users: {
            include: {
              tenant: true,
            },
            orderBy: [{ tenant: { name: 'asc' } }, { createdAt: 'asc' }],
          },
        },
        orderBy: [{ email: 'asc' }],
      }),
    ]);

    return {
      tenants: tenants.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        industryPreset:
          tenant.config?.industryPreset === IndustryPreset.DIAGNOSTICS_LAB
            ? IndustryPreset.DIAGNOSTICS_LAB
            : IndustryPreset.GENERIC,
        userCount: tenant._count.users,
        createdAt: tenant.createdAt.toISOString(),
      })),
      accounts: accounts.map((account) => ({
        id: account.id,
        email: account.email,
        phone: account.phone,
        status: account.status as UserStatus,
        membershipCount: account.users.length,
        memberships: account.users.map((user) => this.mapMembershipSummary(user)),
      })),
      users: accounts.flatMap((account) =>
        account.users.map((user) =>
          this.mapPlatformAdminUserSummary({
            userId: user.id,
            accountId: account.id,
            tenantId: user.tenantId,
            tenantName: user.tenant.name,
            tenantSlug: user.tenant.slug,
            name: user.name,
            email: account.email,
            phone: account.phone,
            role: user.role,
            isTenantAdmin: user.isTenantAdmin,
            isSuperAdmin: user.isSuperAdmin,
            status: user.status,
            accountStatus: account.status,
          }),
        ),
      ),
    };
  }

  async createTenant(
    actor: { isSuperAdmin: boolean },
    dto: CreateTenantDto,
  ): Promise<PlatformTenantSummary> {
    this.ensureSuperAdmin(actor);

    const slug = dto.slug.trim().toLowerCase();
    const existing = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new BadRequestException('A tenant with this slug already exists');
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name.trim(),
        slug,
      },
    });

    await this.createTenantConfig(tenant.id, dto.industryPreset);
    this.tenantConfig.invalidate(tenant.id);
    await this.accessControl.ensureTenantInitialized(tenant.id);

    await this.createMembershipRecord({
      tenantId: tenant.id,
      name: dto.adminName,
      email: dto.adminEmail,
      phone: dto.adminPhone,
      password: dto.adminPassword,
      isTenantAdmin: true,
    });

    const created = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenant.id },
      include: {
        config: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    return {
      id: created.id,
      name: created.name,
      slug: created.slug,
      industryPreset:
        created.config?.industryPreset === IndustryPreset.DIAGNOSTICS_LAB
          ? IndustryPreset.DIAGNOSTICS_LAB
          : IndustryPreset.GENERIC,
      userCount: created._count.users,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async createMembership(
    actor: { isSuperAdmin: boolean },
    dto: CreatePlatformMembershipDto,
  ): Promise<PlatformMembershipSummary> {
    this.ensureSuperAdmin(actor);
    const membership = await this.createMembershipRecord(dto);
    return this.mapMembershipSummary(membership);
  }

  async updateUser(
    actor: { isSuperAdmin: boolean; id: string },
    userId: string,
    dto: UpdatePlatformUserDto,
  ): Promise<PlatformAdminUserSummary> {
    this.ensureSuperAdmin(actor);

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        account: {
          include: {
            users: {
              select: {
                tenantId: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (userId === actor.id && dto.status === UserStatus.INACTIVE) {
      throw new BadRequestException('You cannot deactivate your own user');
    }

    const normalizedEmail = dto.email?.trim().toLowerCase();
    const normalizedPhone =
      dto.phone === undefined
        ? undefined
        : dto.phone === null
          ? null
          : normalizePhoneNumber(dto.phone) || null;

    if (normalizedEmail && normalizedEmail !== existing.account.email) {
      const emailOwner = await this.prisma.account.findUnique({
        where: { email: normalizedEmail },
      });

      if (emailOwner && emailOwner.id !== existing.accountId) {
        throw new BadRequestException('Email is already used by another account');
      }

      const tenantIds = existing.account.users.map((membership) => membership.tenantId);
      const conflictingTenantMembership = await this.prisma.user.findFirst({
        where: {
          accountId: { not: existing.accountId },
          tenantId: { in: tenantIds },
          email: normalizedEmail,
        },
        include: {
          tenant: true,
        },
      });

      if (conflictingTenantMembership) {
        throw new BadRequestException(
          `Email already exists in tenant "${conflictingTenantMembership.tenant.name}" for another account`,
        );
      }
    }

    if (
      normalizedPhone !== undefined
      && normalizedPhone
      && normalizedPhone !== existing.account.phone
    ) {
      const phoneOwner = await this.prisma.account.findUnique({
        where: { phone: normalizedPhone },
      });

      if (phoneOwner && phoneOwner.id !== existing.accountId) {
        throw new BadRequestException('Mobile number is already used by another account');
      }
    }

    const userData: { name?: string; status?: UserStatus } = {};
    if (dto.name !== undefined) {
      userData.name = dto.name.trim();
    }
    if (dto.status !== undefined) {
      userData.status = dto.status as UserStatus;
    }

    const accountData: { email?: string; phone?: string | null } = {};
    if (normalizedEmail !== undefined) {
      accountData.email = normalizedEmail;
    }
    if (normalizedPhone !== undefined) {
      accountData.phone = normalizedPhone;
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(accountData).length > 0) {
        await tx.account.update({
          where: { id: existing.accountId },
          data: accountData,
        });

        await tx.user.updateMany({
          where: { accountId: existing.accountId },
          data: accountData,
        });
      }

      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userData,
        });
      }
    });

    return this.getPlatformAdminUserSummary(userId);
  }

  async resetUserPassword(
    actor: { isSuperAdmin: boolean },
    userId: string,
    password: string,
  ): Promise<void> {
    this.ensureSuperAdmin(actor);

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        accountId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    await this.accountIdentity.resetPassword(existing.accountId, password);
  }

  private ensureSuperAdmin(actor: { isSuperAdmin: boolean }): void {
    if (!actor.isSuperAdmin) {
      throw new ForbiddenException('SUPER_ADMIN access required');
    }
  }

  private async createTenantConfig(tenantId: string, preset: IndustryPreset): Promise<void> {
    const displayConfig = getPresetDisplayConfig(preset);

    await this.prisma.tenantConfig.create({
      data: {
        tenantId,
        industryPreset: preset,
        configVersion: 1,
        displayConfig,
        timezone: 'Asia/Jakarta',
        businessStart: '09:00',
        businessEnd: '18:00',
        stages: displayConfig.pipelineConfig.stages.map((stage) => stage.label),
        reminderRules: {
          firstReminderMinutes: displayConfig.followupRules.firstReminderMinutes,
          escalationMinutes: displayConfig.followupRules.escalationMinutes,
          postReportFollowupDays: displayConfig.followupRules.postReportFollowupDays,
        },
        templates: [],
        featureFlags: displayConfig.featureFlags,
      },
    });
  }

  private async createMembershipRecord(input: CreatePlatformMembershipDto & { tenantId: string }) {
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

    return user;
  }

  private mapMembershipSummary(user: {
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

  private async getPlatformAdminUserSummary(userId: string): Promise<PlatformAdminUserSummary> {
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

  private mapPlatformAdminUserSummary(input: {
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
}
