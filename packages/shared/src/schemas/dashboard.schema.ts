import { z } from 'zod';

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
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
