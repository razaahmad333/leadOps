import { z } from 'zod';
import { CustomEnquiryFieldSchema, OpdDirectorySchema, TestPackageSchema } from './tenant.schema';

const TimeWindowValueSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm (24-hour format)');

export const TenantSettingsSchema = z.object({
  timezone: z.string(),
  businessStart: z.string(),
  businessEnd: z.string(),
  stages: z.array(z.string()),
  reminderRules: z.object({
    defaultLeadFollowupMinutes: z.number().int().positive(),
    firstReminderMinutes: z.number(),
    escalationMinutes: z.number(),
    postReportFollowupDays: z.number().int().positive(),
  }).strict(),
  templates: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      body: z.string(),
    }).strict(),
  ),
  featureFlags: z.record(z.boolean()),
}).strict();

export type TenantSettings = z.infer<typeof TenantSettingsSchema>;

export const TenantIntakeConfigSchema = z.object({
  customEnquiryFields: z.array(CustomEnquiryFieldSchema),
  testPackages: z.array(TestPackageSchema),
  opdDirectory: OpdDirectorySchema,
}).strict();

export type TenantIntakeConfig = z.infer<typeof TenantIntakeConfigSchema>;

export const UpdateTenantIntakeConfigSchema = TenantIntakeConfigSchema;

export type UpdateTenantIntakeConfigDto = z.infer<typeof UpdateTenantIntakeConfigSchema>;

export const UpdateTenantSettingsSchema = z
  .object({
    timezone: z.string().min(1).optional(),
    businessStart: TimeWindowValueSchema.optional(),
    businessEnd: TimeWindowValueSchema.optional(),
    reminderRules: z
      .object({
        defaultLeadFollowupMinutes: z.number().int().positive().optional(),
        firstReminderMinutes: z.number().int().nonnegative().optional(),
        escalationMinutes: z.number().int().nonnegative().optional(),
        postReportFollowupDays: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.timezone !== undefined
      || value.businessStart !== undefined
      || value.businessEnd !== undefined
      || value.reminderRules !== undefined,
    {
      message: 'At least one tenant setting field must be provided',
    },
  );

export type UpdateTenantSettingsDto = z.infer<typeof UpdateTenantSettingsSchema>;
