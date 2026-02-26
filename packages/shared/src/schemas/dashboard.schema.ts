import { z } from 'zod';

export const DashboardStatsSchema = z.object({
  new: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  missed: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  avgResponseMinutes: z.number().nonnegative(),
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
