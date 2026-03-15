import { z } from 'zod';

export const DashboardTrendPointSchema = z.object({
  date: z.string(),
  label: z.string(),
  primary: z.number().nonnegative(),
  secondary: z.number().nonnegative(),
  tertiary: z.number().nonnegative(),
});

export const DashboardBreakdownItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number().nonnegative(),
});

export const DashboardComparisonItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number().nonnegative(),
  secondaryValue: z.number().nonnegative().optional(),
});

export const DashboardAnalyticsSchema = z.object({
  trend: z.object({
    primaryLabel: z.string(),
    secondaryLabel: z.string(),
    tertiaryLabel: z.string(),
    points: z.array(DashboardTrendPointSchema),
  }),
  pipelineBreakdown: z.object({
    title: z.string(),
    items: z.array(DashboardBreakdownItemSchema),
  }),
  followupHealth: z.object({
    items: z.array(DashboardBreakdownItemSchema),
  }),
  comparison: z.object({
    kind: z.enum(['branch', 'source']),
    title: z.string(),
    primaryLabel: z.string(),
    secondaryLabel: z.string().optional(),
    items: z.array(DashboardComparisonItemSchema),
  }),
});

export const DashboardStatsSchema = z.object({
  new: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  missed: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  avgResponseMinutes: z.number().nonnegative(),
  enquiriesToday: z.number().int().nonnegative(),
  bookingsToday: z.number().int().nonnegative(),
  pendingFollowups: z.number().int().nonnegative(),
  missedFollowups: z.number().int().nonnegative(),
  postReportFollowupsDue: z.number().int().nonnegative(),
  analytics: DashboardAnalyticsSchema,
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export type DashboardTrendPoint = z.infer<typeof DashboardTrendPointSchema>;
export type DashboardBreakdownItem = z.infer<typeof DashboardBreakdownItemSchema>;
export type DashboardComparisonItem = z.infer<typeof DashboardComparisonItemSchema>;
export type DashboardAnalytics = z.infer<typeof DashboardAnalyticsSchema>;
