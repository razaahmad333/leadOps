import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { REALTIME_INVALIDATION_EVENTS, REMINDER_QUEUE } from '@leadops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { WorkerRealtimePublisherService } from './realtime-publisher.service';

interface ReminderJobData {
  tenantId: string;
  followUpId: string;
}

@Processor(REMINDER_QUEUE)
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimePublisher: WorkerRealtimePublisherService,
  ) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<void> {
    if (job.name !== 'followup-reminder') {
      this.logger.log(`Skipping unknown reminder job: ${job.name}`);
      return;
    }

    const followUp = await this.prisma.followUp.findFirst({
      where: { id: job.data.followUpId, tenantId: job.data.tenantId },
      include: { lead: true },
    });

    if (!followUp || followUp.done) {
      this.logger.log(`Follow-up ${job.data.followUpId} already handled`);
      return;
    }

    this.logger.log(
      JSON.stringify({
        event: 'followup.due',
        tenantId: job.data.tenantId,
        followUpId: followUp.id,
        leadId: followUp.leadId,
      }),
    );

    await this.realtimePublisher.publish({
      event: REALTIME_INVALIDATION_EVENTS.TODAY_INVALIDATE,
      tenantId: job.data.tenantId,
      branchId: followUp.lead.branchId ?? undefined,
      leadId: followUp.leadId,
      reason: 'followup.due',
      occurredAt: new Date().toISOString(),
      source: 'worker',
    });
    await this.realtimePublisher.publish({
      event: REALTIME_INVALIDATION_EVENTS.LEAD_DETAIL_INVALIDATE,
      tenantId: job.data.tenantId,
      branchId: followUp.lead.branchId ?? undefined,
      leadId: followUp.leadId,
      reason: 'followup.due',
      occurredAt: new Date().toISOString(),
      source: 'worker',
    });

    if (followUp.scheduledAt < new Date() && !followUp.escalatedAt) {
      await this.prisma.followUp.update({
        where: { id: followUp.id },
        data: { escalatedAt: new Date() },
      });

      this.logger.warn(
        JSON.stringify({
          event: 'followup.missed.escalated',
          tenantId: job.data.tenantId,
          followUpId: followUp.id,
          message: 'Owner notification placeholder executed',
        }),
      );

      await this.realtimePublisher.publish({
        event: REALTIME_INVALIDATION_EVENTS.TODAY_INVALIDATE,
        tenantId: job.data.tenantId,
        branchId: followUp.lead.branchId ?? undefined,
        leadId: followUp.leadId,
        reason: 'followup.escalated',
        occurredAt: new Date().toISOString(),
        source: 'worker',
      });
      await this.realtimePublisher.publish({
        event: REALTIME_INVALIDATION_EVENTS.LEAD_DETAIL_INVALIDATE,
        tenantId: job.data.tenantId,
        branchId: followUp.lead.branchId ?? undefined,
        leadId: followUp.leadId,
        reason: 'followup.escalated',
        occurredAt: new Date().toISOString(),
        source: 'worker',
      });
    }
  }
}
