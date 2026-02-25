import { z } from 'zod';

export const DashboardStatsSchema = z.object({
  new: z.number().int().nonnegative(),
  contacted: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  todayFollowups: z.number().int().nonnegative(),
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
