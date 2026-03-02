import { z } from 'zod';
import { BranchScopeType, Role, UserStatus } from '../enums';
import { BranchScopeSummarySchema } from './rbac.schema';

export const LoginSchema = z.object({
  phone: z.string().min(6, 'Invalid mobile number').max(30, 'Invalid mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export const RequestLoginOtpSchema = z.object({
  phone: z.string().min(6, 'Invalid mobile number').max(30, 'Invalid mobile number'),
});

export type RequestLoginOtpDto = z.infer<typeof RequestLoginOtpSchema>;

export const RequestLoginOtpResponseSchema = z.object({
  verificationId: z.string(),
  devOtpCode: z.string().nullable().optional(),
});

export type RequestLoginOtpResponse = z.infer<typeof RequestLoginOtpResponseSchema>;

export const VerifyLoginOtpSchema = z.object({
  phone: z.string().min(6, 'Invalid mobile number').max(30, 'Invalid mobile number'),
  verificationId: z.string().min(1),
  otpCode: z.string().min(4, 'Enter the OTP code').max(12, 'Enter the OTP code'),
});

export type VerifyLoginOtpDto = z.infer<typeof VerifyLoginOtpSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.nativeEnum(Role),
  tenantId: z.string(),
  isSuperAdmin: z.boolean().default(false),
  isTenantAdmin: z.boolean().default(false),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  effectivePermissions: z.array(z.string()).default([]),
  branchScope: BranchScopeSummarySchema.default({
    scopeType: BranchScopeType.ALL_BRANCHES,
    branchIds: [],
    branchNames: [],
  }),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  user: AuthUserSchema,
  tenantName: z.string(),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;
