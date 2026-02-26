import { z } from 'zod';

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
