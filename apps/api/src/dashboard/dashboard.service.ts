import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';
import { DashboardStats } from '@leadops/shared';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<DashboardStats> {
    const { tenantId } = getTenantContext();

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [newCount, contacted, pending, won, lost, todayFollowups] = await Promise.all([
      this.prisma.lead.count({ where: { tenantId, status: 'NEW' } }),
      this.prisma.lead.count({ where: { tenantId, status: 'CONTACTED' } }),
      this.prisma.lead.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.lead.count({ where: { tenantId, status: 'WON' } }),
      this.prisma.lead.count({ where: { tenantId, status: 'LOST' } }),
      this.prisma.followUp.count({
        where: { tenantId, done: false, scheduledAt: { gte: start, lte: end } },
      }),
    ]);

    return { new: newCount, contacted, pending, won, lost, todayFollowups };
  }
}
