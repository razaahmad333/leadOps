import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  GetPublicTenantBrandingQueryDto,
  GetPublicTenantBrandingQuerySchema,
  PublicTenantBranding,
} from '@leadops/shared';
import { Public } from '../common/decorators/public.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TenantConfigService } from './tenant-config.service';

@ApiTags('public')
@Controller('public')
export class PublicTenantController {
  constructor(private readonly tenantConfig: TenantConfigService) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @Get('tenant-branding')
  @ApiOperation({ summary: 'Get public login branding values for a tenant slug' })
  getTenantBranding(
    @Query(new ZodValidationPipe(GetPublicTenantBrandingQuerySchema)) query: GetPublicTenantBrandingQueryDto,
  ): Promise<PublicTenantBranding> {
    return this.tenantConfig.getPublicTenantBranding(query.tenant);
  }
}
