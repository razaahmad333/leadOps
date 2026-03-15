import type {
  BranchScopeType,
  IndustryPreset,
  PlatformTenantRole,
  TenantSettings,
  UserStatus,
} from '@leadops/shared';

export type TenantSortBy = 'createdAt' | 'name' | 'userCount';
export type SortOrder = 'asc' | 'desc';

export type TenantFormState = {
  name: string;
  slug: string;
  industryPreset: IndustryPreset;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
};

export type MembershipFormState = {
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  isTenantAdmin: boolean;
};

export type EditUserTarget = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  isTenantAdmin: boolean;
  isSuperAdmin: boolean;
  roleIds: string[];
  branchScopeType: BranchScopeType;
  branchIds: string[];
  defaultBranchId: string | null;
};

export type EditUserFormState = {
  name: string;
  email: string;
  phone: string;
  status: UserStatus;
  isTenantAdmin: boolean;
  roleIds: string[];
  scopeType: BranchScopeType;
  branchIds: string[];
  defaultBranchId: string;
};

export type PasswordTarget = {
  userId: string;
  email: string;
};

export type PasswordFormState = {
  password: string;
  confirmPassword: string;
};

export type TenantSettingsDraft = {
  timezone: string;
  businessStart: string;
  businessEnd: string;
  defaultLeadFollowupMinutes: string;
  firstReminderMinutes: string;
  escalationMinutes: string;
  postReportFollowupDays: string;
};

export type BranchFormState = {
  name: string;
  description: string;
};

export type RoleFormState = {
  name: string;
  description: string;
  permissionKeys: string[];
};

export type DrawerTab = 'tenant' | 'users' | 'branches' | 'roles' | 'settings' | 'audit';

export type PlatformRoleDialogState = {
  open: boolean;
  editingRole: PlatformTenantRole | null;
  formError: string | null;
};

export type TenantSettingsInput = Pick<
  TenantSettings,
  'timezone' | 'businessStart' | 'businessEnd'
> & {
  reminderRules: {
    defaultLeadFollowupMinutes: number;
    firstReminderMinutes: number;
    escalationMinutes: number;
    postReportFollowupDays: number;
  };
};
