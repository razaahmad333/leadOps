import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @Public()
  @Get('metrics')
  @ApiOperation({ summary: 'Minimal metrics snapshot hook' })
  getMetrics() {
    return this.metrics.snapshot();
  }
}
