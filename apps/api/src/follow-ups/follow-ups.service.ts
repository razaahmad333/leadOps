import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ACTIVE_LEAD_STATUSES,
  CreateFollowUpDto,
  DOMAIN_EVENTS,
  TodayFollowUp,
} from '@leadops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { QueueService } from '../queue/queue.service';
import { DomainEventsService } from '../events/domain-events.service';

@Injectable()
export class FollowUpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly queue: QueueService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  async findToday(): Promise<TodayFollowUp[]> {
    const tenant = getTenantContext();

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const followUps = await this.prisma.followUp.findMany({
      where: {
        tenantId: tenant?.tenantId,
        done: false,
        scheduledAt: { gte: start, lte: end },
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return followUps.map((item) => ({
      ...item,
      assignedUser: item.user,
    })) as TodayFollowUp[];
  }

  async create(dto: CreateFollowUpDto, actorId?: string): Promise<{ id: string }> {
    const tenant = getTenantContext();
    const lead = await this.prisma.lead.findFirst({
      where: { id: dto.leadId, tenantId: tenant?.tenantId },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const scheduledAt = await this.tenantConfig.normalizeToBusinessWindow(dto.scheduledAt);

    const followUp = await this.prisma.followUp.create({
      data: {
        tenantId: lead.tenantId,
        leadId: lead.id,
        assignedTo: dto.assignedTo,
        scheduledAt,
        note: dto.note,
      },
    });

    await this.prisma.lead.update({
      where: { id: lead.id },
      data: { nextFollowUpAt: scheduledAt },
    });

    await this.prisma.leadActivity.create({
      data: {
        tenantId: lead.tenantId,
        leadId: lead.id,
        actorId: actorId ?? null,
        type: 'followup.scheduled',
        message: 'Follow-up scheduled',
      },
    });

    await this.queue.scheduleFollowupReminder(
      { tenantId: lead.tenantId, followUpId: followUp.id },
      scheduledAt,
    );

    return { id: followUp.id };
  }

  async markDone(id: string, actorId?: string): Promise<{ success: boolean }> {
    const tenant = getTenantContext();

    const followUp = await this.prisma.followUp.findFirst({
      where: { id, tenantId: tenant?.tenantId },
      include: { lead: true },
    });

    if (!followUp) {
      throw new NotFoundException('Follow-up not found');
    }

    await this.prisma.followUp.update({
      where: { id },
      data: {
        done: true,
        doneAt: new Date(),
      },
    });

    await this.prisma.leadActivity.create({
      data: {
        tenantId: followUp.tenantId,
        leadId: followUp.leadId,
        actorId: actorId ?? null,
        type: 'followup.completed',
        message: 'Follow-up marked as done',
      },
    });

    if (ACTIVE_LEAD_STATUSES.includes(followUp.lead.status as unknown as (typeof ACTIVE_LEAD_STATUSES)[number])) {
      const nextPending = await this.prisma.followUp.findFirst({
        where: {
          tenantId: followUp.tenantId,
          leadId: followUp.leadId,
          done: false,
        },
        orderBy: { scheduledAt: 'asc' },
      });

      if (!nextPending) {
        const autoScheduled = await this.tenantConfig.normalizeToBusinessWindow(
          new Date(Date.now() + 24 * 60 * 60 * 1000),
        );

        const generated = await this.prisma.followUp.create({
          data: {
            tenantId: followUp.tenantId,
            leadId: followUp.leadId,
            assignedTo: followUp.assignedTo,
            scheduledAt: autoScheduled,
            note: 'Auto-generated to keep active lead follow-up continuity',
          },
        });

        await this.prisma.lead.update({
          where: { id: followUp.leadId },
          data: { nextFollowUpAt: autoScheduled },
        });

        await this.queue.scheduleFollowupReminder(
          { tenantId: followUp.tenantId, followUpId: generated.id },
          autoScheduled,
        );
      }
    } else {
      await this.prisma.lead.update({
        where: { id: followUp.leadId },
        data: { nextFollowUpAt: null },
      });
    }

    this.domainEvents.emit(DOMAIN_EVENTS.FOLLOWUP_DUE, {
      tenantId: followUp.tenantId,
      leadId: followUp.leadId,
      followUpId: followUp.id,
    });

    return { success: true };
  }
}
