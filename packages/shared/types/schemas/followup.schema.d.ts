import { z } from 'zod';
export declare const CreateFollowUpSchema: z.ZodObject<{
    leadId: z.ZodString;
    scheduledAt: z.ZodDate;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    leadId: string;
    scheduledAt: Date;
    note?: string | undefined;
}, {
    leadId: string;
    scheduledAt: Date;
    note?: string | undefined;
}>;
export type CreateFollowUpDto = z.infer<typeof CreateFollowUpSchema>;
export declare const FollowUpSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    leadId: z.ZodString;
    scheduledAt: z.ZodDate;
    note: z.ZodNullable<z.ZodString>;
    done: z.ZodBoolean;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    createdAt: Date;
    updatedAt: Date;
    leadId: string;
    scheduledAt: Date;
    note: string | null;
    done: boolean;
}, {
    id: string;
    tenantId: string;
    createdAt: Date;
    updatedAt: Date;
    leadId: string;
    scheduledAt: Date;
    note: string | null;
    done: boolean;
}>;
export type FollowUp = z.infer<typeof FollowUpSchema>;
