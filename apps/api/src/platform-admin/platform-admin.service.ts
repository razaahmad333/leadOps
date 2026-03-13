import { Injectable } from '@nestjs/common';
import {
  AuthUser,
  CreateBranchDto,
  CreatePlatformMembershipDto,
  CreatePlatformTenantRoleDto,
  CreateTenantDto,
  ListPlatformTenantOptionsQueryDto,
  ListPlatformTenantsQueryDto,
  PlatformAdminOverview,
  PlatformAdminSummary,
  PlatformTenantRole,
  PlatformTenantDetails,
  PlatformTenantOption,
  PlatformTenantListResponse,
  PlatformTenantDetailsQueryDto,
  PlatformAdminUserSummary,
  PlatformMembershipSummary,
  PlatformTenantSummary,
  TenantSettings,
  UpdateBranchDto,
  UpdatePlatformTenantRoleDto,
  UpdateTenantSettingsDto,
  UpdatePlatformUserDto,
} from '@leadops/shared';
import { PlatformAdminReadService } from './platform-admin-read.service';
import { PlatformAdminTenantOpsService } from './platform-admin-tenant-ops.service';
import { PlatformAdminRoleOpsService } from './platform-admin-role-ops.service';
import { PlatformAdminUserOpsService } from './platform-admin-user-ops.service';

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly read: PlatformAdminReadService,
    private readonly tenantOps: PlatformAdminTenantOpsService,
    private readonly roleOps: PlatformAdminRoleOpsService,
    private readonly userOps: PlatformAdminUserOpsService,
  ) {}

  getOverview(actor: { isSuperAdmin: boolean }): Promise<PlatformAdminOverview> {
    return this.read.getOverview(actor);
  }

  getSummary(actor: { isSuperAdmin: boolean }): Promise<PlatformAdminSummary> {
    return this.read.getSummary(actor);
  }

  listTenants(
    actor: { isSuperAdmin: boolean },
    query: ListPlatformTenantsQueryDto,
  ): Promise<PlatformTenantListResponse> {
    return this.read.listTenants(actor, query);
  }

  listTenantOptions(
    actor: { isSuperAdmin: boolean },
    query: ListPlatformTenantOptionsQueryDto,
  ): Promise<PlatformTenantOption[]> {
    return this.read.listTenantOptions(actor, query);
  }

  getTenantDetails(
    actor: { isSuperAdmin: boolean },
    tenantId: string,
    query: PlatformTenantDetailsQueryDto = {},
  ): Promise<PlatformTenantDetails> {
    return this.read.getTenantDetails(actor, tenantId, query);
  }

  updateTenantSettings(
    actor: { isSuperAdmin: boolean; id: string },
    tenantId: string,
    dto: UpdateTenantSettingsDto,
  ): Promise<TenantSettings> {
    return this.tenantOps.updateTenantSettings(actor, tenantId, dto);
  }

  createTenantBranch(
    actor: { isSuperAdmin: boolean; id: string },
    tenantId: string,
    dto: CreateBranchDto,
  ): Promise<PlatformTenantDetails['branches'][number]> {
    return this.tenantOps.createTenantBranch(actor, tenantId, dto);
  }

  updateTenantBranch(
    actor: { isSuperAdmin: boolean; id: string },
    tenantId: string,
    branchId: string,
    dto: UpdateBranchDto,
  ): Promise<PlatformTenantDetails['branches'][number]> {
    return this.tenantOps.updateTenantBranch(actor, tenantId, branchId, dto);
  }

  listTenantRoles(
    actor: { isSuperAdmin: boolean },
    tenantId: string,
  ): Promise<PlatformTenantRole[]> {
    return this.roleOps.listTenantRoles(actor, tenantId);
  }

  createTenantRole(
    actor: { isSuperAdmin: boolean; id: string },
    tenantId: string,
    dto: CreatePlatformTenantRoleDto,
  ): Promise<PlatformTenantRole> {
    return this.roleOps.createTenantRole(actor, tenantId, dto);
  }

  updateTenantRole(
    actor: { isSuperAdmin: boolean; id: string },
    tenantId: string,
    roleId: string,
    dto: UpdatePlatformTenantRoleDto,
  ): Promise<PlatformTenantRole> {
    return this.roleOps.updateTenantRole(actor, tenantId, roleId, dto);
  }

  createTenant(
    actor: { isSuperAdmin: boolean; id?: string },
    dto: CreateTenantDto,
  ): Promise<PlatformTenantSummary> {
    return this.tenantOps.createTenant(actor, dto);
  }

  createMembership(
    actor: { isSuperAdmin: boolean; id: string },
    dto: CreatePlatformMembershipDto,
  ): Promise<PlatformMembershipSummary> {
    return this.userOps.createMembership(actor, dto);
  }

  updateUser(
    actor: AuthUser,
    userId: string,
    dto: UpdatePlatformUserDto,
  ): Promise<PlatformAdminUserSummary> {
    return this.userOps.updateUser(actor, userId, dto);
  }

  resetUserPassword(
    actor: AuthUser,
    userId: string,
    password: string,
  ): Promise<void> {
    return this.userOps.resetUserPassword(actor, userId, password);
  }
}
