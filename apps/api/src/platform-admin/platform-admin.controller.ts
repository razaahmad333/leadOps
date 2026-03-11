import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CreatePlatformMembershipDto,
  CreatePlatformMembershipSchema,
  CreateTenantDto,
  CreateTenantSchema,
  PlatformAdminOverview,
  PlatformAdminUserSummary,
  PlatformMembershipSummary,
  PlatformTenantSummary,
  ResetPlatformUserPasswordDto,
  ResetPlatformUserPasswordSchema,
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

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update a user membership/account as platform admin' })
  updateUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePlatformUserSchema)) dto: UpdatePlatformUserDto,
  ): Promise<PlatformAdminUserSummary> {
    return this.platformAdmin.updateUser(user, id, dto);
  }

  @Post('users/:id/reset-password')
  @ApiOperation({ summary: 'Reset user account password as platform admin' })
  async resetUserPassword(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ResetPlatformUserPasswordSchema)) dto: ResetPlatformUserPasswordDto,
  ): Promise<{ success: boolean }> {
    await this.platformAdmin.resetUserPassword(user, id, dto.password);
    return { success: true };
  }
}
