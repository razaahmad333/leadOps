import type {
  CreateBranchDto,
  CreatePlatformMembershipDto,
  CreatePlatformTenantRoleDto,
  CreateTenantDto,
  PermissionGroup,
  PlatformAdminSummary,
  PlatformTenantDetails,
  PlatformTenantListResponse,
  PlatformTenantOption,
  PlatformTenantRole,
  ResetPlatformUserPasswordDto,
  TenantSettings,
  UpdateBranchDto,
  UpdatePlatformTenantRoleDto,
  UpdatePlatformUserDto,
  UpdateTenantSettingsDto,
} from '@leadops/shared';
import { api } from '../../lib/api';

type TenantListParams = {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: string;
  q?: string;
};

type TenantDetailsParams = {
  usersPage: number;
  usersPageSize: number;
  auditPage: number;
  auditPageSize: number;
};

export function getPlatformSummary(): Promise<PlatformAdminSummary> {
  return api.get<PlatformAdminSummary>('/v1/platform-admin/summary');
}

export function listPlatformTenants(params: TenantListParams): Promise<PlatformTenantListResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });
  if (params.q?.trim()) {
    query.set('q', params.q.trim());
  }
  return api.get<PlatformTenantListResponse>(`/v1/platform-admin/tenants?${query.toString()}`);
}

export function listTenantOptions(queryText: string, limit = 30): Promise<PlatformTenantOption[]> {
  const query = new URLSearchParams({
    limit: String(limit),
  });
  if (queryText.trim()) {
    query.set('q', queryText.trim());
  }
  return api.get<PlatformTenantOption[]>(`/v1/platform-admin/tenant-options?${query.toString()}`);
}

export function getTenantDetails(tenantId: string, params: TenantDetailsParams): Promise<PlatformTenantDetails> {
  const query = new URLSearchParams({
    usersPage: String(params.usersPage),
    usersPageSize: String(params.usersPageSize),
    auditPage: String(params.auditPage),
    auditPageSize: String(params.auditPageSize),
  });
  return api.get<PlatformTenantDetails>(`/v1/platform-admin/tenants/${tenantId}/details?${query.toString()}`);
}

export function createTenant(payload: CreateTenantDto): Promise<void> {
  return api.post('/v1/platform-admin/tenants', payload);
}

export function createMembership(payload: CreatePlatformMembershipDto): Promise<void> {
  return api.post('/v1/platform-admin/memberships', payload);
}

export function patchTenantSettings(tenantId: string, payload: UpdateTenantSettingsDto): Promise<TenantSettings> {
  return api.patch<TenantSettings>(`/v1/platform-admin/tenants/${tenantId}/settings`, payload);
}

export function listTenantRoles(tenantId: string): Promise<PlatformTenantRole[]> {
  return api.get<PlatformTenantRole[]>(`/v1/platform-admin/tenants/${tenantId}/roles`);
}

export function createTenantRole(tenantId: string, payload: CreatePlatformTenantRoleDto): Promise<PlatformTenantRole> {
  return api.post<PlatformTenantRole>(`/v1/platform-admin/tenants/${tenantId}/roles`, payload);
}

export function patchTenantRole(
  tenantId: string,
  roleId: string,
  payload: UpdatePlatformTenantRoleDto,
): Promise<PlatformTenantRole> {
  return api.patch<PlatformTenantRole>(`/v1/platform-admin/tenants/${tenantId}/roles/${roleId}`, payload);
}

export function listPermissionGroups(): Promise<PermissionGroup[]> {
  return api.get<PermissionGroup[]>('/v1/permissions');
}

export function createTenantBranch(tenantId: string, payload: CreateBranchDto): Promise<void> {
  return api.post(`/v1/platform-admin/tenants/${tenantId}/branches`, payload);
}

export function patchTenantBranch(tenantId: string, branchId: string, payload: UpdateBranchDto): Promise<void> {
  return api.patch(`/v1/platform-admin/tenants/${tenantId}/branches/${branchId}`, payload);
}

export function patchPlatformUser(userId: string, payload: UpdatePlatformUserDto): Promise<void> {
  return api.patch(`/v1/platform-admin/users/${userId}`, payload);
}

export function resetPlatformUserPassword(userId: string, payload: ResetPlatformUserPasswordDto): Promise<void> {
  return api.post(`/v1/platform-admin/users/${userId}/reset-password`, payload);
}
