import { z } from 'zod';
import { IndustryPreset, Role, UserStatus } from '../enums';

export const PlatformMembershipSummarySchema = z.object({
  userId: z.string(),
  tenantId: z.string(),
  tenantName: z.string(),
  tenantSlug: z.string(),
  role: z.nativeEnum(Role),
  isTenantAdmin: z.boolean().default(false),
  isSuperAdmin: z.boolean().default(false),
  status: z.nativeEnum(UserStatus),
});

export type PlatformMembershipSummary = z.infer<typeof PlatformMembershipSummarySchema>;

export const PlatformAdminUserSummarySchema = z.object({
  userId: z.string(),
  accountId: z.string(),
  tenantId: z.string(),
  tenantName: z.string(),
  tenantSlug: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  role: z.nativeEnum(Role),
  isTenantAdmin: z.boolean().default(false),
  isSuperAdmin: z.boolean().default(false),
  status: z.nativeEnum(UserStatus),
  accountStatus: z.nativeEnum(UserStatus),
});

export type PlatformAdminUserSummary = z.infer<typeof PlatformAdminUserSummarySchema>;

export const PlatformTenantSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  industryPreset: z.nativeEnum(IndustryPreset),
  userCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export type PlatformTenantSummary = z.infer<typeof PlatformTenantSummarySchema>;

export const PlatformAccountSummarySchema = z.object({
  id: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  status: z.nativeEnum(UserStatus),
  membershipCount: z.number().int().nonnegative(),
  memberships: z.array(PlatformMembershipSummarySchema),
});

export type PlatformAccountSummary = z.infer<typeof PlatformAccountSummarySchema>;

export const PlatformAdminOverviewSchema = z.object({
  tenants: z.array(PlatformTenantSummarySchema),
  accounts: z.array(PlatformAccountSummarySchema),
  users: z.array(PlatformAdminUserSummarySchema),
});

export type PlatformAdminOverview = z.infer<typeof PlatformAdminOverviewSchema>;

export const CreateTenantSchema = z.object({
  name: z.string().min(2, 'Tenant name is required').max(120),
  slug: z
    .string()
    .min(2, 'Tenant slug is required')
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only'),
  industryPreset: z.nativeEnum(IndustryPreset).default(IndustryPreset.GENERIC),
  adminName: z.string().min(2, 'Admin name is required').max(120),
  adminEmail: z.string().email(),
  adminPhone: z.string().min(6).max(30).optional().or(z.literal('')),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type CreateTenantDto = z.infer<typeof CreateTenantSchema>;

export const CreatePlatformMembershipSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(2, 'User name is required').max(120),
  email: z.string().email(),
  phone: z.string().min(6).max(30).optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  isTenantAdmin: z.boolean().default(false),
});

export type CreatePlatformMembershipDto = z.infer<typeof CreatePlatformMembershipSchema>;

export const UpdatePlatformUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).nullable().optional().or(z.literal('')),
  status: z.nativeEnum(UserStatus).optional(),
});

export type UpdatePlatformUserDto = z.infer<typeof UpdatePlatformUserSchema>;

export const ResetPlatformUserPasswordSchema = z.object({
  password: z.string().min(8).max(120),
});

export type ResetPlatformUserPasswordDto = z.infer<typeof ResetPlatformUserPasswordSchema>;
