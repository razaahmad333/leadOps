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
});

export type Branch = z.infer<typeof BranchSchema>;

export const BranchScopeSummarySchema = z.object({
  scopeType: z.nativeEnum(BranchScopeType),
  branchIds: z.array(z.string()),
  branchNames: z.array(z.string()),
});

export type BranchScopeSummary = z.infer<typeof BranchScopeSummarySchema>;

export const BranchScopeInputSchema = z.object({
  scopeType: z.nativeEnum(BranchScopeType),
  branchIds: z.array(z.string()).default([]),
});

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
  name: z.string().min(2).max(80),
  description: z.string().max(250).optional(),
  permissionKeys: z.array(z.string()).default([]),
});

export type CreateRoleDto = z.infer<typeof CreateRoleSchema>;

export const UpdateRoleSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(250).nullable().optional(),
  permissionKeys: z.array(z.string()).optional(),
});

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
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  roleId: z.string().optional(),
  roleIds: z.array(z.string()).optional(),
  isTenantAdmin: z.boolean().optional(),
  branchScope: BranchScopeInputSchema.optional(),
  defaultBranchId: z.string().nullable().optional(),
  password: z.string().min(8).max(120).optional(),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  roleId: z.string().nullable().optional(),
  roleIds: z.array(z.string()).optional(),
  isTenantAdmin: z.boolean().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  branchScope: BranchScopeInputSchema.optional(),
  defaultBranchId: z.string().nullable().optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

export const ResetPasswordSchema = z.object({
  password: z.string().min(8).max(120),
});

export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
