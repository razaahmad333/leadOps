import { Body, Controller, ForbiddenException, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  TenantIntakeConfig,
  UpdateTenantIntakeConfigDto,
  UpdateTenantIntakeConfigSchema,
} from '@leadops/shared';
import { Permissions } from '../access-control/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TenantConfigService } from '../tenant/tenant-config.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly tenantConfig: TenantConfigService) {}

  @Get()
  @Permissions('settings.view')
  @ApiOperation({ summary: 'Get tenant settings (read-only)' })
  getTenantSettings() {
    return this.tenantConfig.getSettings();
  }

  @Get('intake-config')
  @Permissions('settings.view')
  @ApiOperation({ summary: 'Get tenant enquiry fields and test packages config' })
  getIntakeConfig(@CurrentUser() user: AuthUser): Promise<TenantIntakeConfig> {
    this.ensureTenantAdmin(user);
    return this.tenantConfig.getIntakeConfig(user.tenantId);
  }

  @Patch('intake-config')
  @Permissions('settings.view')
  @ApiOperation({ summary: 'Update tenant enquiry fields and test packages config' })
  updateIntakeConfig(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateTenantIntakeConfigSchema)) dto: UpdateTenantIntakeConfigDto,
  ): Promise<TenantIntakeConfig> {
    this.ensureTenantAdmin(user);
    return this.tenantConfig.updateIntakeConfig(dto, user.tenantId);
  }

  private ensureTenantAdmin(user: AuthUser): void {
    if (!user.isTenantAdmin && !user.isSuperAdmin) {
      throw new ForbiddenException('TENANT_ADMIN access required');
    }
  }
}
