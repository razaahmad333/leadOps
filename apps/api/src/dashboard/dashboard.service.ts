import { Injectable } from '@nestjs/common';
import { DashboardStats, MilestoneKey } from '@leadops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { getTenantContext } from '../tenant/tenant.store';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async getStats(): Promise<DashboardStats> {
    const tenant = getTenantContext();
    const now = new Date();

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const displayConfig = await this.tenantConfig.getDisplayConfig(tenant?.tenantId);
    const bookingStageKeys = displayConfig.pipelineConfig.stages
      .filter((stage) => stage.milestone === MilestoneKey.BOOKING_CONFIRMED)
      .map((stage) => stage.key);

    const [newCount, pendingCount, wonCount, lostCount, pendingFollowups, missedFollowups, enquiriesToday, bookingsToday, postReportFollowupsDue, responseSample] =
      await Promise.all([
        this.prisma.lead.count({ where: { tenantId: tenant?.tenantId, status: 'NEW' } }),
        this.prisma.lead.count({ where: { tenantId: tenant?.tenantId, status: 'PENDING' } }),
        this.prisma.lead.count({ where: { tenantId: tenant?.tenantId, status: 'WON' } }),
        this.prisma.lead.count({ where: { tenantId: tenant?.tenantId, status: 'LOST' } }),
        this.prisma.followUp.count({
          where: {
            tenantId: tenant?.tenantId,
            done: false,
          },
        }),
        this.prisma.followUp.count({
          where: {
            tenantId: tenant?.tenantId,
            done: false,
            scheduledAt: { lt: now },
          },
        }),
        this.prisma.lead.count({
          where: {
            tenantId: tenant?.tenantId,
            createdAt: { gte: start, lte: end },
          },
        }),
        this.prisma.lead.count({
          where: {
            tenantId: tenant?.tenantId,
            stageKey: { in: bookingStageKeys.length > 0 ? bookingStageKeys : ['BOOKING_CONFIRMED'] },
            updatedAt: { gte: start, lte: end },
          },
        }),
        this.prisma.followUp.count({
          where: {
            tenantId: tenant?.tenantId,
            kind: 'POST_REPORT',
            done: false,
            scheduledAt: { lte: end },
          },
        }),
        this.prisma.lead.findMany({
          where: { tenantId: tenant?.tenantId },
          include: {
            followUps: {
              take: 1,
              orderBy: { createdAt: 'asc' },
              select: { createdAt: true },
            },
          },
          take: 100,
        }),
      ]);

    const responseTimes = responseSample
      .filter((lead) => lead.followUps.length > 0)
      .map((lead) => {
        const first = lead.followUps[0];
        return (first.createdAt.getTime() - lead.createdAt.getTime()) / 1000 / 60;
      });

    const avgResponseMinutes =
      responseTimes.length === 0
        ? 0
        : Number(
            (responseTimes.reduce((sum, minutes) => sum + minutes, 0) / responseTimes.length).toFixed(
              1,
            ),
          );

    return {
      new: newCount,
      pending: pendingCount,
      missed: missedFollowups,
      won: wonCount,
      lost: lostCount,
      avgResponseMinutes,
      enquiriesToday,
      bookingsToday,
      pendingFollowups,
      missedFollowups,
      postReportFollowupsDue,
    };
  }
}
