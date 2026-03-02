import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardStats } from '@leadops/shared';
import { Permissions } from '../access-control/permissions.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get owner dashboard counters' })
  getStats(): Promise<DashboardStats> {
    return this.dashboardService.getStats();
  }
}
