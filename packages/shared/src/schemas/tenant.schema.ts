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

export const PipelineStageSchema = z.object({
  key: z.string(),
  label: z.string(),
  internalStatus: z.nativeEnum(LeadStatus),
  milestone: z.nativeEnum(MilestoneKey).optional(),
  allowedNext: z.array(z.string()).default([]),
  terminal: z.boolean().default(false),
  order: z.number().int().nonnegative().default(0),
});

export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const FollowupRulesSchema = z.object({
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
});

export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

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
  featureFlags: z.record(z.boolean()).default({}),
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
