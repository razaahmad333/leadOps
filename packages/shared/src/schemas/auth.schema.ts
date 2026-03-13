import { z } from 'zod';
import { BranchScopeType, Role, UserStatus } from '../enums';
import { BranchScopeSummarySchema } from './rbac.schema';

export const LoginSchema = z.object({
  identifier: z
    .string()
    .min(3, 'Enter your email or mobile number')
    .max(120, 'Enter a valid email or mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
}).strict();

export type LoginDto = z.infer<typeof LoginSchema>;

export const RequestLoginOtpSchema = z.object({
  phone: z.string().min(6, 'Invalid mobile number').max(30, 'Invalid mobile number'),
}).strict();

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
}).strict();

export type VerifyLoginOtpDto = z.infer<typeof VerifyLoginOtpSchema>;

export const TenantOptionSchema = z.object({
  tenantId: z.string(),
  tenantName: z.string(),
  tenantSlug: z.string(),
  userId: z.string(),
  role: z.nativeEnum(Role),
  isSuperAdmin: z.boolean().default(false),
  isTenantAdmin: z.boolean().default(false),
});

export type TenantOption = z.infer<typeof TenantOptionSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.nativeEnum(Role),
  tenantId: z.string(),
  defaultBranchId: z.string().nullable().optional(),
  isSuperAdmin: z.boolean().default(false),
  isTenantAdmin: z.boolean().default(false),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  effectivePermissions: z.array(z.string()).default([]),
  availableTenants: z.array(TenantOptionSchema).default([]),
  branchScope: BranchScopeSummarySchema.default({
    scopeType: BranchScopeType.ALL_BRANCHES,
    branchIds: [],
    branchNames: [],
  }),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginResponseSchema = z.object({
  kind: z.literal('authenticated'),
  accessToken: z.string(),
  user: AuthUserSchema,
  tenantName: z.string(),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const TenantSelectionChallengeSchema = z.object({
  kind: z.literal('tenant_selection_required'),
  selectionToken: z.string(),
  tenants: z.array(TenantOptionSchema).min(2),
});

export type TenantSelectionChallenge = z.infer<typeof TenantSelectionChallengeSchema>;

export const AuthFlowResponseSchema = z.discriminatedUnion('kind', [
  LoginResponseSchema,
  TenantSelectionChallengeSchema,
]);

export type AuthFlowResponse = z.infer<typeof AuthFlowResponseSchema>;

export const SelectTenantSchema = z.object({
  selectionToken: z.string().min(1),
  tenantId: z.string().uuid(),
}).strict();

export type SelectTenantDto = z.infer<typeof SelectTenantSchema>;

export const SwitchTenantSchema = z.object({
  tenantId: z.string().uuid(),
}).strict();

export type SwitchTenantDto = z.infer<typeof SwitchTenantSchema>;
