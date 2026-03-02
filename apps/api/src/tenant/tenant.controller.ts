import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantProfile } from '@leadops/shared';
import { TenantConfigService } from './tenant-config.service';

@ApiTags('tenant')
@ApiBearerAuth()
@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantConfig: TenantConfigService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current tenant profile and UI display config' })
  getCurrentTenant(): Promise<TenantProfile> {
    return this.tenantConfig.getTenantProfile();
  }
}
