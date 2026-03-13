import { z } from 'zod';
import { BranchScopeType, Role, UserStatus } from '../enums';

export const PermissionDefinitionSchema = z.object({
  key: z.string(),
  description: z.string(),
  group: z.string(),
});

export type PermissionDefinition = z.infer<typeof PermissionDefinitionSchema>;

export const PermissionGroupSchema = z.object({
  group: z.string(),
  permissions: z.array(PermissionDefinitionSchema),
});

export type PermissionGroup = z.infer<typeof PermissionGroupSchema>;

export const BranchSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
});

export type Branch = z.infer<typeof BranchSchema>;

export const CreateBranchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
}).strict();

export type CreateBranchDto = z.infer<typeof CreateBranchSchema>;

export const UpdateBranchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
}).strict().refine(
  (value) => value.name !== undefined || value.description !== undefined || value.isActive !== undefined,
  { message: 'At least one branch field must be provided' },
);

export type UpdateBranchDto = z.infer<typeof UpdateBranchSchema>;

export const BranchScopeSummarySchema = z.object({
  scopeType: z.nativeEnum(BranchScopeType),
  branchIds: z.array(z.string()),
  branchNames: z.array(z.string()),
});

export type BranchScopeSummary = z.infer<typeof BranchScopeSummarySchema>;

export const BranchScopeInputSchema = z.object({
  scopeType: z.nativeEnum(BranchScopeType),
  branchIds: z.array(z.string().uuid()).default([]),
}).strict();

export type BranchScopeInput = z.infer<typeof BranchScopeInputSchema>;

export const RoleSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  permissionKeys: z.array(z.string()),
  userCount: z.number().int().nonnegative().default(0),
});

export type RoleSummary = z.infer<typeof RoleSummarySchema>;

export const RoleDetailSchema = RoleSummarySchema.extend({
  tenantId: z.string().nullable(),
});

export type RoleDetail = z.infer<typeof RoleDetailSchema>;

export const CreateRoleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(250).optional(),
  permissionKeys: z.array(z.string()).default([]),
}).strict();

export type CreateRoleDto = z.infer<typeof CreateRoleSchema>;

export const UpdateRoleSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(250).nullable().optional(),
  permissionKeys: z.array(z.string()).optional(),
}).strict();

export type UpdateRoleDto = z.infer<typeof UpdateRoleSchema>;

export const RoleReferenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  isSystem: z.boolean(),
});

export type RoleReference = z.infer<typeof RoleReferenceSchema>;

export const TeamUserSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string().email(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  legacyRole: z.nativeEnum(Role),
  status: z.nativeEnum(UserStatus),
  isTenantAdmin: z.boolean(),
  isSuperAdmin: z.boolean(),
  roles: z.array(RoleReferenceSchema),
  roleNames: z.array(z.string()),
  branchScope: BranchScopeSummarySchema,
  defaultBranchId: z.string().nullable(),
});

export type TeamUser = z.infer<typeof TeamUserSchema>;

export const CreateUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().max(30).optional(),
  roleId: z.string().uuid().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  isTenantAdmin: z.boolean().optional(),
  branchScope: BranchScopeInputSchema.optional(),
  defaultBranchId: z.string().uuid().nullable().optional(),
  password: z.string().min(8).max(120).optional(),
}).strict();

export type CreateUserDto = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  roleId: z.string().uuid().nullable().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  isTenantAdmin: z.boolean().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  branchScope: BranchScopeInputSchema.optional(),
  defaultBranchId: z.string().uuid().nullable().optional(),
}).strict();

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

export const ResetPasswordSchema = z.object({
  password: z.string().min(8).max(120),
}).strict();

export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
