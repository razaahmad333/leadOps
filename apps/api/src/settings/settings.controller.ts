import { Body, Controller, ForbiddenException, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  TenantIntakeConfig,
  TenantSettings,
  UpdateTenantIntakeConfigDto,
  UpdateTenantIntakeConfigSchema,
  UpdateTenantSettingsDto,
  UpdateTenantSettingsSchema,
} from '@leadops/shared';
import { Permissions } from '../access-control/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { QueueService } from '../queue/queue.service';
import { TenantConfigService } from '../tenant/tenant-config.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly tenantConfig: TenantConfigService,
    private readonly queue: QueueService,
  ) {}

  @Get()
  @Permissions('settings.view')
  @ApiOperation({ summary: 'Get tenant settings (read-only)' })
  getTenantSettings() {
    return this.tenantConfig.getSettings();
  }

  @Patch()
  @Permissions('settings.manage')
  @ApiOperation({ summary: 'Update tenant business window and reminder settings' })
  updateTenantSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateTenantSettingsSchema)) dto: UpdateTenantSettingsDto,
  ): Promise<TenantSettings> {
    this.ensureTenantAdmin(user);
    return this.updateTenantSettingsAndRebuildDashboard(user, dto);
  }

  @Get('intake-config')
  @Permissions('settings.view')
  @ApiOperation({ summary: 'Get tenant enquiry fields and test packages config' })
  getIntakeConfig(@CurrentUser() user: AuthUser): Promise<TenantIntakeConfig> {
    this.ensureTenantAdmin(user);
    return this.tenantConfig.getIntakeConfig(user.tenantId);
  }

  @Patch('intake-config')
  @Permissions('settings.manage')
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

  private async updateTenantSettingsAndRebuildDashboard(
    user: AuthUser,
    dto: UpdateTenantSettingsDto,
  ): Promise<TenantSettings> {
    const before = await this.tenantConfig.getSettings(user.tenantId);
    const updated = await this.tenantConfig.updateSettings(dto, user.tenantId, user.id);

    if (dto.timezone && dto.timezone.trim() !== before.timezone) {
      await this.queue.enqueueDashboardTenantRebuild({
        tenantId: user.tenantId,
        reason: 'tenant.settings.timezone.updated',
      });
    }

    return updated;
  }
}
