import { z } from 'zod';
import { IndustryPreset, LeadStatus, MilestoneKey } from '../enums';

export const DashboardMetricKeySchema = z.enum([
  'new',
  'pending',
  'missed',
  'won',
  'lost',
  'avgResponseMinutes',
  'enquiriesToday',
  'bookingsToday',
  'pendingFollowups',
  'missedFollowups',
  'postReportFollowupsDue',
]);

export type DashboardMetricKey = z.infer<typeof DashboardMetricKeySchema>;

export const DisplayVocabularySchema = z.object({
  leadSingular: z.string(),
  leadPlural: z.string(),
  leadCreateTitle: z.string(),
  dashboardTitle: z.string(),
  todayFollowupsTitle: z.string(),
  bookingLabel: z.string(),
  reportLabel: z.string(),
  stageLabel: z.string(),
  followupLabel: z.string(),
  sidebarSubtitle: z.string().optional(),
  emptyLeads: z.string(),
  emptyFollowups: z.string(),
  statusLabels: z.record(z.string()),
});

export type DisplayVocabulary = z.infer<typeof DisplayVocabularySchema>;

export const DashboardCardConfigSchema = z.object({
  key: z.string(),
  label: z.string(),
  metricKey: DashboardMetricKeySchema,
  icon: z.string().optional(),
});

export type DashboardCardConfig = z.infer<typeof DashboardCardConfigSchema>;

export const LeadFieldConfigSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'email', 'phone', 'select', 'boolean', 'datetime', 'textarea']),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  section: z.enum(['core', 'intake']).default('intake'),
});

export type LeadFieldConfig = z.infer<typeof LeadFieldConfigSchema>;

export const CustomEnquiryFieldSchema = LeadFieldConfigSchema.extend({
  key: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-zA-Z0-9_]*$/, 'Use letters, numbers, and underscore. Must start with a lowercase letter.'),
  label: z.string().min(2).max(80),
  section: z.literal('intake').default('intake'),
}).strict();

export type CustomEnquiryField = z.infer<typeof CustomEnquiryFieldSchema>;

export const TestPackageSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  description: z.string().max(400).default(''),
  enabled: z.boolean().default(true),
}).strict();

export type TestPackage = z.infer<typeof TestPackageSchema>;

export const OpdDepartmentSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  isActive: z.boolean().default(true),
}).strict();

export type OpdDepartment = z.infer<typeof OpdDepartmentSchema>;

export const OpdDoctorSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  departmentIds: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
}).strict();

export type OpdDoctor = z.infer<typeof OpdDoctorSchema>;

export const OpdDirectorySchema = z.object({
  departments: z.array(OpdDepartmentSchema).default([]),
  doctors: z.array(OpdDoctorSchema).default([]),
}).strict();

export type OpdDirectory = z.infer<typeof OpdDirectorySchema>;

export const FollowupPurposeOptionSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
}).strict();

export type FollowupPurposeOption = z.infer<typeof FollowupPurposeOptionSchema>;

export const PipelineStageSchema = z.object({
  key: z.string(),
  label: z.string(),
  internalStatus: z.nativeEnum(LeadStatus),
  milestone: z.nativeEnum(MilestoneKey).optional(),
  allowedNext: z.array(z.string()).default([]),
  followupPurposes: z.array(FollowupPurposeOptionSchema).min(1),
  defaultFollowupPurposeKey: z.string().min(1).max(80),
  followupGuidance: z.string().max(400).optional(),
  terminal: z.boolean().default(false),
  order: z.number().int().nonnegative().default(0),
});

export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const FollowupRulesSchema = z.object({
  defaultLeadFollowupMinutes: z.number().int().positive().default(120),
  firstReminderMinutes: z.number().int().nonnegative(),
  escalationMinutes: z.number().int().nonnegative(),
  postReportFollowupDays: z.number().int().positive().default(3),
  postReportFollowupNote: z.string().default('Post-report follow-up call'),
});

export type FollowupRules = z.infer<typeof FollowupRulesSchema>;

export const ThemeConfigSchema = z.object({
  accentColor: z.string().optional(),
  logoMarkUrl: z.string().optional(),
  sidebarTitle: z.string().optional(),
}).strict();

export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

export const TenantLoginBrandingSchema = z.object({
  eyebrow: z.string().min(1).max(80),
  headline: z.string().min(1).max(220),
  subheadline: z.string().min(1).max(500),
  highlightOneLabel: z.string().min(1).max(100),
  highlightOneText: z.string().min(1).max(200),
  highlightTwoLabel: z.string().min(1).max(100),
  highlightTwoText: z.string().min(1).max(200),
  calloutTitle: z.string().min(1).max(140),
  calloutText: z.string().min(1).max(300),
  logoUrl: z.string().url().optional(),
  logoAlt: z.string().min(1).max(120).optional(),
}).strict();

export type TenantLoginBranding = z.infer<typeof TenantLoginBrandingSchema>;

export const TenantDisplayConfigSchema = z.object({
  vocabulary: DisplayVocabularySchema,
  dashboardConfig: z.object({
    cards: z.array(DashboardCardConfigSchema),
  }),
  leadFieldsConfig: z.object({
    fields: z.array(LeadFieldConfigSchema),
  }),
  pipelineConfig: z.object({
    stages: z.array(PipelineStageSchema),
  }),
  followupRules: FollowupRulesSchema,
  themeConfig: ThemeConfigSchema.optional(),
  loginBranding: TenantLoginBrandingSchema.optional(),
  featureFlags: z.record(z.boolean()).default({}),
  customEnquiryFields: z.array(CustomEnquiryFieldSchema).default([]),
  testPackages: z.array(TestPackageSchema).default([]),
  opdDirectory: OpdDirectorySchema.optional(),
});

export type TenantDisplayConfig = z.infer<typeof TenantDisplayConfigSchema>;

export const TenantProfileSchema = z.object({
  tenantId: z.string(),
  tenantName: z.string(),
  tenantSlug: z.string(),
  configVersion: z.number().int().positive(),
  industryPreset: z.nativeEnum(IndustryPreset),
  displayConfig: TenantDisplayConfigSchema,
});

export type TenantProfile = z.infer<typeof TenantProfileSchema>;

export const GetPublicTenantBrandingQuerySchema = z.object({
  tenant: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/),
}).strict();

export type GetPublicTenantBrandingQueryDto = z.infer<typeof GetPublicTenantBrandingQuerySchema>;

export const PublicTenantBrandingSchema = z.object({
  tenantName: z.string(),
  tenantSlug: z.string(),
  branding: TenantLoginBrandingSchema,
});

export type PublicTenantBranding = z.infer<typeof PublicTenantBrandingSchema>;
