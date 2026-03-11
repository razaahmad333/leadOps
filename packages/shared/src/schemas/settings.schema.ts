import { z } from 'zod';
import { CustomEnquiryFieldSchema, TestPackageSchema } from './tenant.schema';

export const TenantSettingsSchema = z.object({
  timezone: z.string(),
  businessStart: z.string(),
  businessEnd: z.string(),
  stages: z.array(z.string()),
  reminderRules: z.object({
    firstReminderMinutes: z.number(),
    escalationMinutes: z.number(),
  }),
  templates: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      body: z.string(),
    }),
  ),
  featureFlags: z.record(z.boolean()),
});

export type TenantSettings = z.infer<typeof TenantSettingsSchema>;

export const TenantIntakeConfigSchema = z.object({
  customEnquiryFields: z.array(CustomEnquiryFieldSchema),
  testPackages: z.array(TestPackageSchema),
});

export type TenantIntakeConfig = z.infer<typeof TenantIntakeConfigSchema>;

export const UpdateTenantIntakeConfigSchema = TenantIntakeConfigSchema;

export type UpdateTenantIntakeConfigDto = z.infer<typeof UpdateTenantIntakeConfigSchema>;
