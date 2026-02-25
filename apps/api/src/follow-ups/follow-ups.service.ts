import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';
import { CreateFollowUpDto } from '@leadops/shared';

@Injectable()
export class FollowUpsService {
  constructor(private readonly prisma: PrismaService) {}

  async findToday() {
    const { tenantId } = getTenantContext();

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return this.prisma.followUp.findMany({
      where: {
        tenantId,
        done: false,
        scheduledAt: { gte: start, lte: end },
      },
      orderBy: { scheduledAt: 'asc' },
      include: { lead: { select: { name: true, phone: true } } },
    });
  }

  async create(dto: CreateFollowUpDto) {
    const { tenantId } = getTenantContext();
    return this.prisma.followUp.create({ data: { ...dto, tenantId } });
  }

  async markDone(id: string) {
    const { tenantId } = getTenantContext();
    const existing = await this.prisma.followUp.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException(`FollowUp ${id} not found`);
    return this.prisma.followUp.update({ where: { id }, data: { done: true } });
  }
}
