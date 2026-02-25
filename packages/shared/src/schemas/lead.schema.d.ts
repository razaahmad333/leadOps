import { z } from 'zod';
import { LeadStatus } from '../enums.js';
export declare const CreateLeadSchema: z.ZodObject<{
    name: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    source?: string | undefined;
}, {
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    source?: string | undefined;
}>;
export type CreateLeadDto = z.infer<typeof CreateLeadSchema>;
export declare const UpdateLeadStatusSchema: z.ZodObject<{
    status: z.ZodNativeEnum<typeof LeadStatus>;
}, "strip", z.ZodTypeAny, {
    status: LeadStatus;
}, {
    status: LeadStatus;
}>;
export type UpdateLeadStatusDto = z.infer<typeof UpdateLeadStatusSchema>;
export declare const LeadSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    name: z.ZodString;
    phone: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    source: z.ZodNullable<z.ZodString>;
    status: z.ZodNativeEnum<typeof LeadStatus>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    email: string | null;
    status: LeadStatus;
    tenantId: string;
    phone: string | null;
    source: string | null;
}, {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    email: string | null;
    status: LeadStatus;
    tenantId: string;
    phone: string | null;
    source: string | null;
}>;
export type Lead = z.infer<typeof LeadSchema>;
