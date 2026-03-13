import { z } from 'zod';
import { IndustryPreset, Role, UserStatus } from '../enums';
import { BranchScopeInputSchema, BranchScopeSummarySchema, RoleReferenceSchema } from './rbac.schema';
import { TenantSettingsSchema } from './settings.schema';

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

export const PlatformAdminSummarySchema = z.object({
  tenantCount: z.number().int().nonnegative(),
  accountCount: z.number().int().nonnegative(),
  membershipCount: z.number().int().nonnegative(),
});

export type PlatformAdminSummary = z.infer<typeof PlatformAdminSummarySchema>;

export const PlatformTenantOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export type PlatformTenantOption = z.infer<typeof PlatformTenantOptionSchema>;

export const PlatformTenantSortBySchema = z.enum(['createdAt', 'name', 'userCount']);
export const PlatformSortOrderSchema = z.enum(['asc', 'desc']);

export const ListPlatformTenantsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().trim().max(120).optional(),
  sortBy: PlatformTenantSortBySchema.default('createdAt'),
  sortOrder: PlatformSortOrderSchema.default('desc'),
}).strict();

export type ListPlatformTenantsQueryDto = z.infer<typeof ListPlatformTenantsQuerySchema>;

export const PlatformTenantListResponseSchema = z.object({
  items: z.array(PlatformTenantSummarySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
});

export type PlatformTenantListResponse = z.infer<typeof PlatformTenantListResponseSchema>;

export const ListPlatformTenantOptionsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
}).strict();

export type ListPlatformTenantOptionsQueryDto = z.infer<typeof ListPlatformTenantOptionsQuerySchema>;

export const PlatformTenantUserDetailSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  role: z.nativeEnum(Role),
  roles: z.array(RoleReferenceSchema),
  roleNames: z.array(z.string()),
  status: z.nativeEnum(UserStatus),
  isTenantAdmin: z.boolean(),
  isSuperAdmin: z.boolean(),
  branchScope: BranchScopeSummarySchema,
  defaultBranchId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PlatformTenantUserDetail = z.infer<typeof PlatformTenantUserDetailSchema>;

export const PlatformTenantBranchDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PlatformTenantBranchDetail = z.infer<typeof PlatformTenantBranchDetailSchema>;

export const PlatformTenantAuditEventSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  action: z.string(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
});

export type PlatformTenantAuditEvent = z.infer<typeof PlatformTenantAuditEventSchema>;

export const PlatformPageMetaSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
});

export type PlatformPageMeta = z.infer<typeof PlatformPageMetaSchema>;

export const PlatformTenantDetailsQuerySchema = z.object({
  usersPage: z.coerce.number().int().positive().optional(),
  usersPageSize: z.coerce.number().int().positive().max(100).optional(),
  auditPage: z.coerce.number().int().positive().optional(),
  auditPageSize: z.coerce.number().int().positive().max(100).optional(),
}).strict();

export type PlatformTenantDetailsQueryDto = z.infer<typeof PlatformTenantDetailsQuerySchema>;

export const PlatformTenantDetailsSchema = z.object({
  tenant: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    industryPreset: z.nativeEnum(IndustryPreset),
    userCount: z.number().int().nonnegative(),
    branchCount: z.number().int().nonnegative(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  settings: TenantSettingsSchema,
  availableRoles: z.array(RoleReferenceSchema),
  users: z.array(PlatformTenantUserDetailSchema),
  usersPage: PlatformPageMetaSchema.optional(),
  branches: z.array(PlatformTenantBranchDetailSchema),
  auditEvents: z.array(PlatformTenantAuditEventSchema),
  auditEventsPage: PlatformPageMetaSchema.optional(),
});

export type PlatformTenantDetails = z.infer<typeof PlatformTenantDetailsSchema>;

export const PlatformTenantRoleSchema = z.object({
  id: z.string(),
  tenantId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  permissionKeys: z.array(z.string()),
  userCount: z.number().int().nonnegative(),
});

export type PlatformTenantRole = z.infer<typeof PlatformTenantRoleSchema>;

export const CreatePlatformTenantRoleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(250).optional(),
  permissionKeys: z.array(z.string()).default([]),
}).strict();

export type CreatePlatformTenantRoleDto = z.infer<typeof CreatePlatformTenantRoleSchema>;

export const UpdatePlatformTenantRoleSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(250).nullable().optional(),
  permissionKeys: z.array(z.string()).optional(),
}).strict();

export type UpdatePlatformTenantRoleDto = z.infer<typeof UpdatePlatformTenantRoleSchema>;

export const CreateTenantSchema = z.object({
  name: z.string().trim().min(2, 'Tenant name is required').max(120),
  slug: z
    .string()
    .trim()
    .min(2, 'Tenant slug is required')
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only'),
  industryPreset: z.nativeEnum(IndustryPreset).default(IndustryPreset.GENERIC),
  adminName: z.string().trim().min(2, 'Admin name is required').max(120),
  adminEmail: z.string().trim().email(),
  adminPhone: z.string().min(6).max(30).optional().or(z.literal('')),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).strict();

export type CreateTenantDto = z.infer<typeof CreateTenantSchema>;

export const CreatePlatformMembershipSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().trim().min(2, 'User name is required').max(120),
  email: z.string().trim().email(),
  phone: z.string().min(6).max(30).optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  isTenantAdmin: z.boolean().default(false),
}).strict();

export type CreatePlatformMembershipDto = z.infer<typeof CreatePlatformMembershipSchema>;

export const UpdatePlatformUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().max(30).nullable().optional().or(z.literal('')),
  roleId: z.string().uuid().nullable().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  isTenantAdmin: z.boolean().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  branchScope: BranchScopeInputSchema.optional(),
  defaultBranchId: z.string().uuid().nullable().optional(),
}).strict();

export type UpdatePlatformUserDto = z.infer<typeof UpdatePlatformUserSchema>;

export const ResetPlatformUserPasswordSchema = z.object({
  password: z.string().min(8).max(120),
}).strict();

export type ResetPlatformUserPasswordDto = z.infer<typeof ResetPlatformUserPasswordSchema>;
