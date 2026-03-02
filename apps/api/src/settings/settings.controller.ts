import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../access-control/permissions.decorator';
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
}
