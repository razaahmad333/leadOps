import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantConfigService } from '../tenant/tenant-config.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly tenantConfig: TenantConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get tenant settings (read-only)' })
  getTenantSettings() {
    return this.tenantConfig.getSettings();
  }
}
