import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BranchScopeType,
  CreatePlatformMembershipDto,
  PlatformAdminUserSummary,
  PlatformMembershipSummary,
  Role,
  UpdatePlatformUserDto,
  UserStatus,
} from '@leadops/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { AccountIdentityService } from '../accounts/account-identity.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhoneNumber } from '../common/utils/phone.util';
import { resolveDefaultBranchId, resolveRoleIds } from '../common/utils/user-access.util';
import { PlatformAdminSharedService } from './platform-admin.shared.service';

@Injectable()
export class PlatformAdminUserOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly accountIdentity: AccountIdentityService,
    private readonly shared: PlatformAdminSharedService,
  ) {}

  async createMembership(
    actor: { isSuperAdmin: boolean; id: string },
    dto: CreatePlatformMembershipDto,
  ): Promise<PlatformMembershipSummary> {
    this.shared.ensureSuperAdmin(actor);
    const membership = await this.shared.createMembershipRecord(dto, actor.id);
    return this.shared.mapMembershipSummary(membership);
  }

  async updateUser(
    actor: { isSuperAdmin: boolean; id: string },
    userId: string,
    dto: UpdatePlatformUserDto,
  ): Promise<PlatformAdminUserSummary> {
    this.shared.ensureSuperAdmin(actor);

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        branchScopes: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
          orderBy: { branch: { name: 'asc' } },
        },
        account: {
          include: {
            users: {
              select: {
                tenantId: true,
              },
            },
          },
        },
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { role: { name: 'asc' } },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (userId === actor.id && dto.status === UserStatus.INACTIVE) {
      throw new BadRequestException('You cannot deactivate your own user');
    }

    if (existing.isSuperAdmin && dto.isTenantAdmin !== undefined && dto.isTenantAdmin !== existing.isTenantAdmin) {
      throw new BadRequestException('Cannot change tenant-admin flag for SUPER_ADMIN user');
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

    const nextIsTenantAdmin = dto.isTenantAdmin ?? existing.isTenantAdmin;
    const currentIsAllBranchesUser = existing.isTenantAdmin || existing.isSuperAdmin;
    const nextIsAllBranchesUser = nextIsTenantAdmin || existing.isSuperAdmin;
    const hasExplicitRoleUpdate = dto.roleId !== undefined || dto.roleIds !== undefined;
    const resolvedRoleIds = hasExplicitRoleUpdate
      ? resolveRoleIds(dto.roleId, dto.roleIds)
      : existing.userRoles.map((entry) => entry.role.id);
    const shouldUpdateRoles = hasExplicitRoleUpdate || dto.isTenantAdmin !== undefined;
    const shouldUpdateTenantAdmin = dto.isTenantAdmin !== undefined && dto.isTenantAdmin !== existing.isTenantAdmin;

    let nextRoleIds = existing.userRoles.map((entry) => entry.role.id);
    let roleMetadataIds = resolvedRoleIds;

    if (shouldUpdateRoles) {
      const uniqueRoleIds = [...new Set(resolvedRoleIds)];
      const scopedRoles =
        uniqueRoleIds.length === 0
          ? []
          : await this.prisma.permissionRole.findMany({
              where: {
                id: { in: uniqueRoleIds },
                OR: [{ tenantId: existing.tenantId }, { tenantId: null }],
              },
              select: { id: true },
            });

      if (uniqueRoleIds.length > 0 && scopedRoles.length !== uniqueRoleIds.length) {
        throw new ForbiddenException('One or more roles do not belong to this tenant');
      }

      const nextRoleSet = new Set(scopedRoles.map((role) => role.id));

      const adminRole = await this.accessControl.getTenantAdminRole(existing.tenantId);
      if (adminRole) {
        if (nextIsTenantAdmin) {
          nextRoleSet.add(adminRole.id);
        } else {
          nextRoleSet.delete(adminRole.id);
        }
      }

      if (!existing.isSuperAdmin && !nextIsTenantAdmin && nextRoleSet.size === 0) {
        throw new BadRequestException('At least one role must be assigned for non-admin users');
      }

      nextRoleIds = [...nextRoleSet];
      roleMetadataIds = [...nextRoleSet];
    }

    const assignedRoles = shouldUpdateRoles
      ? await this.prisma.permissionRole.findMany({
          where: {
            id: { in: nextRoleIds },
          },
          select: {
            name: true,
          },
          orderBy: { name: 'asc' },
        })
      : existing.userRoles.map((entry) => ({ name: entry.role.name }));

    const nextLegacyRole = this.accessControl.determineLegacyRole({
      isSuperAdmin: existing.isSuperAdmin,
      isTenantAdmin: nextIsTenantAdmin,
      roles: assignedRoles,
    });

    await this.shared.ensurePlatformLastOwnerProtection(
      {
        id: existing.id,
        tenantId: existing.tenantId,
        role: existing.role as Role,
      },
      nextLegacyRole,
    );

    const userData: { name?: string; status?: UserStatus; isTenantAdmin?: boolean; role?: Role; defaultBranchId?: string | null } = {};
    if (dto.name !== undefined) {
      userData.name = dto.name.trim();
    }
    if (dto.status !== undefined) {
      userData.status = dto.status as UserStatus;
    }
    if (shouldUpdateTenantAdmin) {
      userData.isTenantAdmin = nextIsTenantAdmin;
    }
    if (nextLegacyRole !== (existing.role as Role)) {
      userData.role = nextLegacyRole;
    }

    const accountData: { email?: string; phone?: string | null } = {};
    if (normalizedEmail !== undefined) {
      accountData.email = normalizedEmail;
    }
    if (normalizedPhone !== undefined) {
      accountData.phone = normalizedPhone;
    }

    const normalizedBranchScope = await this.shared.normalizePlatformUserBranchScope(
      existing.tenantId,
      dto.branchScope,
      nextIsAllBranchesUser,
      existing.branchScopes.map((scope) => scope.branchId),
    );
    const nextDefaultBranchId = resolveDefaultBranchId(
      dto.defaultBranchId === undefined ? existing.defaultBranchId : dto.defaultBranchId,
      normalizedBranchScope,
      nextIsAllBranchesUser,
    );
    const shouldUpdateBranchScope = dto.branchScope !== undefined || currentIsAllBranchesUser !== nextIsAllBranchesUser;
    const shouldUpdateDefaultBranch = dto.defaultBranchId !== undefined
      || nextDefaultBranchId !== existing.defaultBranchId;
    if (shouldUpdateDefaultBranch) {
      userData.defaultBranchId = nextDefaultBranchId;
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

      if (shouldUpdateRoles) {
        await tx.userRole.deleteMany({
          where: { userId },
        });

        if (nextRoleIds.length > 0) {
          await tx.userRole.createMany({
            data: nextRoleIds.map((roleId) => ({ userId, roleId })),
            skipDuplicates: true,
          });
        }
      }

      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userData,
        });
      }

      if (shouldUpdateBranchScope) {
        await tx.userBranchScope.deleteMany({
          where: {
            userId,
          },
        });

        if (normalizedBranchScope.scopeType === BranchScopeType.SELECTED && normalizedBranchScope.branchIds.length > 0) {
          await tx.userBranchScope.createMany({
            data: normalizedBranchScope.branchIds.map((branchId) => ({
              userId,
              branchId,
            })),
            skipDuplicates: true,
          });
        }
      }

      await tx.tenantAuditEvent.create({
        data: {
          tenantId: existing.tenantId,
          actorId: actor.id,
          entityType: 'USER',
          entityId: userId,
          action: 'platform.user.updated',
          metadata: {
            ...(userData.name !== undefined ? { name: userData.name } : {}),
            ...(userData.status !== undefined ? { status: userData.status } : {}),
            ...(accountData.email !== undefined ? { email: accountData.email } : {}),
            ...(accountData.phone !== undefined ? { phone: accountData.phone } : {}),
            ...(shouldUpdateRoles ? { roleIds: roleMetadataIds } : {}),
            ...(shouldUpdateTenantAdmin ? { isTenantAdmin: nextIsTenantAdmin } : {}),
            ...(shouldUpdateBranchScope ? { branchScope: normalizedBranchScope } : {}),
            ...(dto.defaultBranchId !== undefined || shouldUpdateDefaultBranch ? { defaultBranchId: nextDefaultBranchId } : {}),
          },
        },
      });
    });

    if (Object.keys(userData).length > 0 || shouldUpdateRoles || shouldUpdateBranchScope) {
      await this.accessControl.invalidateTenantMembership(userId, existing.tenantId);
    }

    if (Object.keys(accountData).length > 0) {
      await this.accessControl.invalidateAccountMemberships(existing.accountId);
    }

    return this.shared.getPlatformAdminUserSummary(userId);
  }

  async resetUserPassword(
    actor: { isSuperAdmin: boolean; id: string },
    userId: string,
    password: string,
  ): Promise<void> {
    this.shared.ensureSuperAdmin(actor);

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        accountId: true,
        tenantId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    await this.accountIdentity.resetPassword(existing.accountId, password);

    await this.prisma.tenantAuditEvent.create({
      data: {
        tenantId: existing.tenantId,
        actorId: actor.id,
        entityType: 'USER',
        entityId: userId,
        action: 'platform.user.password_reset',
      },
    });
  }
}
