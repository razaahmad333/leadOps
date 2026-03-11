export {
  LeadStatus,
  Role,
  UserStatus,
  BranchScopeType,
  IndustryPreset,
  MilestoneKey,
  ACTIVE_LEAD_STATUSES,
} from './enums';

export {
  DOMAIN_EVENTS,
  type LeadCreatedEvent,
  type StatusChangedEvent,
  type FollowupDueEvent,
  type ReportDeliveredEvent,
} from './events';

export {
  REMINDER_QUEUE,
  REPORT_QUEUE,
  type DailyReportJob,
  type FollowupReminderJob,
} from './queue';

export {
  AuthFlowResponseSchema,
  LoginSchema,
  RequestLoginOtpSchema,
  RequestLoginOtpResponseSchema,
  VerifyLoginOtpSchema,
  LoginResponseSchema,
  TenantSelectionChallengeSchema,
  TenantOptionSchema,
  SelectTenantSchema,
  SwitchTenantSchema,
  AuthUserSchema,
  type AuthFlowResponse,
  type LoginDto,
  type RequestLoginOtpDto,
  type RequestLoginOtpResponse,
  type VerifyLoginOtpDto,
  type LoginResponse,
  type TenantSelectionChallenge,
  type TenantOption,
  type SelectTenantDto,
  type SwitchTenantDto,
  type AuthUser,
} from './schemas/auth.schema';

export {
  CreateLeadSchema,
  UpdateLeadStatusSchema,
  CreateLeadNoteSchema,
  LeadSchema,
  LeadDetailSchema,
  LeadActivitySchema,
  type CreateLeadDto,
  type UpdateLeadStatusDto,
  type CreateLeadNoteDto,
  type Lead,
  type LeadDetail,
  type LeadActivity,
} from './schemas/lead.schema';

export {
  CreateFollowUpSchema,
  FollowUpSchema,
  TodayFollowUpSchema,
  type CreateFollowUpDto,
  type FollowUp,
  type TodayFollowUp,
} from './schemas/followup.schema';

export {
  DashboardStatsSchema,
  type DashboardStats,
} from './schemas/dashboard.schema';

export {
  TenantSettingsSchema,
  TenantIntakeConfigSchema,
  UpdateTenantIntakeConfigSchema,
  type TenantSettings,
  type TenantIntakeConfig,
  type UpdateTenantIntakeConfigDto,
} from './schemas/settings.schema';

export {
  DashboardMetricKeySchema,
  DisplayVocabularySchema,
  DashboardCardConfigSchema,
  LeadFieldConfigSchema,
  CustomEnquiryFieldSchema,
  TestPackageSchema,
  PipelineStageSchema,
  FollowupRulesSchema,
  ThemeConfigSchema,
  TenantDisplayConfigSchema,
  TenantProfileSchema,
  type DashboardMetricKey,
  type DisplayVocabulary,
  type DashboardCardConfig,
  type LeadFieldConfig,
  type CustomEnquiryField,
  type TestPackage,
  type PipelineStage,
  type FollowupRules,
  type ThemeConfig,
  type TenantDisplayConfig,
  type TenantProfile,
} from './schemas/tenant.schema';

export {
  WebsiteFormIntakeSchema,
  type WebsiteFormIntakeDto,
} from './schemas/intake.schema';

export {
  PermissionDefinitionSchema,
  PermissionGroupSchema,
  BranchSchema,
  BranchScopeSummarySchema,
  BranchScopeInputSchema,
  RoleSummarySchema,
  RoleDetailSchema,
  RoleReferenceSchema,
  TeamUserSchema,
  CreateRoleSchema,
  UpdateRoleSchema,
  CreateUserSchema,
  UpdateUserSchema,
  ResetPasswordSchema,
  type PermissionDefinition,
  type PermissionGroup,
  type Branch,
  type BranchScopeSummary,
  type BranchScopeInput,
  type RoleSummary,
  type RoleDetail,
  type RoleReference,
  type TeamUser,
  type CreateRoleDto,
  type UpdateRoleDto,
  type CreateUserDto,
  type UpdateUserDto,
  type ResetPasswordDto,
} from './schemas/rbac.schema';

export {
  PlatformMembershipSummarySchema,
  PlatformAdminUserSummarySchema,
  PlatformTenantSummarySchema,
  PlatformAccountSummarySchema,
  PlatformAdminOverviewSchema,
  CreateTenantSchema,
  CreatePlatformMembershipSchema,
  UpdatePlatformUserSchema,
  ResetPlatformUserPasswordSchema,
  type PlatformMembershipSummary,
  type PlatformAdminUserSummary,
  type PlatformTenantSummary,
  type PlatformAccountSummary,
  type PlatformAdminOverview,
  type CreateTenantDto,
  type CreatePlatformMembershipDto,
  type UpdatePlatformUserDto,
  type ResetPlatformUserPasswordDto,
} from './schemas/platform-admin.schema';
