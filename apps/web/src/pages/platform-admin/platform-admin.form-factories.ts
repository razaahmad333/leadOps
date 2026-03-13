import type { IndustryPreset, PlatformTenantDetails, TenantSettings } from '@leadops/shared';
import type {
  BranchFormState,
  EditUserFormState,
  EditUserTarget,
  MembershipFormState,
  PasswordFormState,
  RoleFormState,
  SortOrder,
  TenantFormState,
  TenantSettingsDraft,
  TenantSortBy,
} from './platform-admin.types';

export function emptyTenantForm(): TenantFormState {
  return {
    name: '',
    slug: '',
    industryPreset: 'GENERIC' as IndustryPreset,
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: '',
  };
}

export function emptyMembershipForm(): MembershipFormState {
  return {
    tenantId: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    isTenantAdmin: false,
  };
}

export function emptyPasswordForm(): PasswordFormState {
  return {
    password: '',
    confirmPassword: '',
  };
}

export function buildEditUserForm(user: EditUserTarget): EditUserFormState {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    status: user.status,
    isTenantAdmin: user.isTenantAdmin,
    roleIds: [...user.roleIds],
    scopeType: user.branchScopeType,
    branchIds: [...user.branchIds],
    defaultBranchId: user.defaultBranchId ?? '',
  };
}

export function toEditUserTarget(user: PlatformTenantDetails['users'][number]): EditUserTarget {
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    isTenantAdmin: user.isTenantAdmin,
    isSuperAdmin: user.isSuperAdmin,
    roleIds: user.roles.map((role) => role.id),
    branchScopeType: user.branchScope.scopeType,
    branchIds: [...user.branchScope.branchIds],
    defaultBranchId: user.defaultBranchId,
  };
}

export function emptyBranchForm(): BranchFormState {
  return {
    name: '',
    description: '',
  };
}

export function emptyRoleForm(): RoleFormState {
  return {
    name: '',
    description: '',
    permissionKeys: [],
  };
}

export function buildTenantSettingsDraft(settings: TenantSettings): TenantSettingsDraft {
  return {
    timezone: settings.timezone,
    businessStart: settings.businessStart,
    businessEnd: settings.businessEnd,
    firstReminderMinutes: String(settings.reminderRules.firstReminderMinutes),
    escalationMinutes: String(settings.reminderRules.escalationMinutes),
    postReportFollowupDays: String(settings.reminderRules.postReportFollowupDays),
  };
}

export function parsePositiveInt(input: string | null, fallback: number): number {
  const value = Number.parseInt(input ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function normalizeTenantSortBy(input: string | null): TenantSortBy {
  if (input === 'name' || input === 'userCount') {
    return input;
  }

  return 'createdAt';
}

export function normalizeSortOrder(input: string | null): SortOrder {
  return input === 'asc' ? 'asc' : 'desc';
}
