import { z } from 'zod';
export declare const DashboardStatsSchema: z.ZodObject<{
    new: z.ZodNumber;
    contacted: z.ZodNumber;
    pending: z.ZodNumber;
    won: z.ZodNumber;
    lost: z.ZodNumber;
    todayFollowups: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    new: number;
    contacted: number;
    pending: number;
    won: number;
    lost: number;
    todayFollowups: number;
}, {
    new: number;
    contacted: number;
    pending: number;
    won: number;
    lost: number;
    todayFollowups: number;
}>;
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
