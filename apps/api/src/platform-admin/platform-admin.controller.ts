import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CreateBranchDto,
  CreateBranchSchema,
  CreatePlatformMembershipDto,
  CreatePlatformMembershipSchema,
  CreateTenantDto,
  CreateTenantSchema,
  PlatformAdminOverview,
  PlatformAdminSummary,
  ListPlatformTenantsQueryDto,
  ListPlatformTenantsQuerySchema,
  PlatformTenantListResponse,
  ListPlatformTenantOptionsQueryDto,
  ListPlatformTenantOptionsQuerySchema,
  PlatformTenantOption,
  PlatformTenantDetailsQueryDto,
  PlatformTenantDetailsQuerySchema,
  PlatformTenantDetails,
  PlatformTenantRole,
  CreatePlatformTenantRoleDto,
  CreatePlatformTenantRoleSchema,
  UpdatePlatformTenantRoleDto,
  UpdatePlatformTenantRoleSchema,
  PlatformAdminUserSummary,
  PlatformMembershipSummary,
  PlatformTenantSummary,
  ResetPlatformUserPasswordDto,
  ResetPlatformUserPasswordSchema,
  TenantSettings,
  UpdateTenantSettingsDto,
  UpdateTenantSettingsSchema,
  UpdateBranchDto,
  UpdateBranchSchema,
  UpdatePlatformUserDto,
  UpdatePlatformUserSchema,
} from '@leadops/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PlatformAdminService } from './platform-admin.service';

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller('platform-admin')
export class PlatformAdminController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @Get()
  @ApiOperation({ summary: 'Get platform admin overview' })
  overview(@CurrentUser() user: AuthUser): Promise<PlatformAdminOverview> {
    return this.platformAdmin.getOverview(user);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get lightweight platform admin counts' })
  getSummary(@CurrentUser() user: AuthUser): Promise<PlatformAdminSummary> {
    return this.platformAdmin.getSummary(user);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'List tenants with server-side pagination and sorting' })
  listTenants(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListPlatformTenantsQuerySchema)) query: ListPlatformTenantsQueryDto,
  ): Promise<PlatformTenantListResponse> {
    return this.platformAdmin.listTenants(user, query);
  }

  @Get('tenant-options')
  @ApiOperation({ summary: 'List lightweight tenant options for selectors' })
  listTenantOptions(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListPlatformTenantOptionsQuerySchema)) query: ListPlatformTenantOptionsQueryDto,
  ): Promise<PlatformTenantOption[]> {
    return this.platformAdmin.listTenantOptions(user, query);
  }

  @Post('tenants')
  @ApiOperation({ summary: 'Create a tenant and its initial tenant admin' })
  createTenant(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateTenantSchema)) dto: CreateTenantDto,
  ): Promise<PlatformTenantSummary> {
    return this.platformAdmin.createTenant(user, dto);
  }

  @Post('memberships')
  @ApiOperation({ summary: 'Create a tenant membership for an existing or new account' })
  createMembership(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreatePlatformMembershipSchema)) dto: CreatePlatformMembershipDto,
  ): Promise<PlatformMembershipSummary> {
    return this.platformAdmin.createMembership(user, dto);
  }

  @Get('tenants/:id/details')
  @ApiOperation({ summary: 'Get platform tenant details for drawer view' })
  getTenantDetails(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(PlatformTenantDetailsQuerySchema)) query: PlatformTenantDetailsQueryDto,
  ): Promise<PlatformTenantDetails> {
    return this.platformAdmin.getTenantDetails(user, id, query);
  }

  @Patch('tenants/:id/settings')
  @ApiOperation({ summary: 'Update tenant reminder and business-window settings as platform admin' })
  updateTenantSettings(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateTenantSettingsSchema)) dto: UpdateTenantSettingsDto,
  ): Promise<TenantSettings> {
    return this.platformAdmin.updateTenantSettings(user, id, dto);
  }

  @Post('tenants/:id/branches')
  @ApiOperation({ summary: 'Create a branch for the selected tenant as platform admin' })
  createTenantBranch(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CreateBranchSchema)) dto: CreateBranchDto,
  ) {
    return this.platformAdmin.createTenantBranch(user, id, dto);
  }

  @Patch('tenants/:tenantId/branches/:branchId')
  @ApiOperation({ summary: 'Update a tenant branch as platform admin' })
  updateTenantBranch(
    @CurrentUser() user: AuthUser,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Body(new ZodValidationPipe(UpdateBranchSchema)) dto: UpdateBranchDto,
  ) {
    return this.platformAdmin.updateTenantBranch(user, tenantId, branchId, dto);
  }

  @Get('tenants/:id/roles')
  @ApiOperation({ summary: 'List roles for a tenant as platform admin' })
  listTenantRoles(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PlatformTenantRole[]> {
    return this.platformAdmin.listTenantRoles(user, id);
  }

  @Post('tenants/:id/roles')
  @ApiOperation({ summary: 'Create a role for a tenant as platform admin' })
  createTenantRole(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CreatePlatformTenantRoleSchema)) dto: CreatePlatformTenantRoleDto,
  ): Promise<PlatformTenantRole> {
    return this.platformAdmin.createTenantRole(user, id, dto);
  }

  @Patch('tenants/:tenantId/roles/:roleId')
  @ApiOperation({ summary: 'Update a role for a tenant as platform admin' })
  updateTenantRole(
    @CurrentUser() user: AuthUser,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @Body(new ZodValidationPipe(UpdatePlatformTenantRoleSchema)) dto: UpdatePlatformTenantRoleDto,
  ): Promise<PlatformTenantRole> {
    return this.platformAdmin.updateTenantRole(user, tenantId, roleId, dto);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update a user membership/account as platform admin' })
  updateUser(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdatePlatformUserSchema)) dto: UpdatePlatformUserDto,
  ): Promise<PlatformAdminUserSummary> {
    return this.platformAdmin.updateUser(user, id, dto);
  }

  @Post('users/:id/reset-password')
  @ApiOperation({ summary: 'Reset user account password as platform admin' })
  async resetUserPassword(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ResetPlatformUserPasswordSchema)) dto: ResetPlatformUserPasswordDto,
  ): Promise<{ success: boolean }> {
    await this.platformAdmin.resetUserPassword(user, id, dto.password);
    return { success: true };
  }
}
