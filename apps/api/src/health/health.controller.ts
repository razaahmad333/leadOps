import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '@leadops/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from '../common/metrics/metrics.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Service health check' })
  getHealth() {
    return {
      status: 'ok',
      service: 'hikmahone-leadops-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Minimal metrics snapshot hook' })
  getMetrics(@CurrentUser() user: AuthUser) {
    if (!user.isSuperAdmin) {
      throw new ForbiddenException('Metrics are only available to superadmin users');
    }

    return this.metrics.snapshot();
  }
}
