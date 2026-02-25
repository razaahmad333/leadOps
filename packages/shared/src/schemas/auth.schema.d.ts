import { z } from 'zod';
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginDto = z.infer<typeof LoginSchema>;
export declare const AuthUserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    name: z.ZodString;
    role: z.ZodEnum<["OWNER", "STAFF"]>;
    tenantId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    email: string;
    role: "OWNER" | "STAFF";
    tenantId: string;
}, {
    id: string;
    name: string;
    email: string;
    role: "OWNER" | "STAFF";
    tenantId: string;
}>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export declare const LoginResponseSchema: z.ZodObject<{
    accessToken: z.ZodString;
    user: z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        name: z.ZodString;
        role: z.ZodEnum<["OWNER", "STAFF"]>;
        tenantId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        email: string;
        role: "OWNER" | "STAFF";
        tenantId: string;
    }, {
        id: string;
        name: string;
        email: string;
        role: "OWNER" | "STAFF";
        tenantId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    user: {
        id: string;
        name: string;
        email: string;
        role: "OWNER" | "STAFF";
        tenantId: string;
    };
    accessToken: string;
}, {
    user: {
        id: string;
        name: string;
        email: string;
        role: "OWNER" | "STAFF";
        tenantId: string;
    };
    accessToken: string;
}>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
