import { Injectable } from '@nestjs/common';
import { DashboardStats } from '@leadops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<DashboardStats> {
    const tenant = getTenantContext();
    const now = new Date();

    const [newCount, pendingCount, wonCount, lostCount, missedCount, responseSample] =
      await Promise.all([
        this.prisma.lead.count({ where: { tenantId: tenant?.tenantId, status: 'NEW' } }),
        this.prisma.lead.count({ where: { tenantId: tenant?.tenantId, status: 'PENDING' } }),
        this.prisma.lead.count({ where: { tenantId: tenant?.tenantId, status: 'WON' } }),
        this.prisma.lead.count({ where: { tenantId: tenant?.tenantId, status: 'LOST' } }),
        this.prisma.followUp.count({
          where: {
            tenantId: tenant?.tenantId,
            done: false,
            scheduledAt: { lt: now },
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
      missed: missedCount,
      won: wonCount,
      lost: lostCount,
      avgResponseMinutes,
    };
  }
}
