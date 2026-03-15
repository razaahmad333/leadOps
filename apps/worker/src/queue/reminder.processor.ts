import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  FOLLOWUP_NOTIFICATION_JOB_KINDS,
  FOLLOWUP_NOTIFICATION_JOB_NAMES,
  type FollowupNotificationJob,
  type FollowupNotificationJobKind,
  type Notification,
  REALTIME_INVALIDATION_EVENTS,
  REMINDER_QUEUE,
} from '@leadops/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkerRealtimePublisherService } from './realtime-publisher.service';

@Processor(REMINDER_QUEUE)
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimePublisher: WorkerRealtimePublisherService,
  ) {
    super();
  }

  async process(job: Job<FollowupNotificationJob>): Promise<void> {
    const kind = this.resolveJobKind(job);

    if (!kind) {
      this.logger.log(`Skipping unknown reminder job: ${job.name}`);
      return;
    }

    const followUp = await this.prisma.followUp.findFirst({
      where: { id: job.data.followUpId, tenantId: job.data.tenantId },
      include: {
        lead: {
          select: {
            id: true,
            branchId: true,
            name: true,
            ownerId: true,
          },
        },
      },
    });

    if (!followUp || followUp.done) {
      this.logger.log(`Follow-up ${job.data.followUpId} already handled`);
      return;
    }

    const recipient = kind === FOLLOWUP_NOTIFICATION_JOB_KINDS.SECOND_ESCALATION
      ? await this.resolveSecondEscalationRecipient(followUp.tenantId, followUp.lead.branchId)
      : await this.resolvePrimaryRecipient(followUp);

    if (!recipient) {
      this.logger.log(`Skipping follow-up ${followUp.id}: no recipient`);
      return;
    }

    if (kind === FOLLOWUP_NOTIFICATION_JOB_KINDS.ESCALATION) {
      const updated = await this.prisma.followUp.updateMany({
        where: {
          id: followUp.id,
          tenantId: followUp.tenantId,
          done: false,
          escalatedAt: null,
        },
        data: {
          escalatedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        return;
      }
    }

    if (kind === FOLLOWUP_NOTIFICATION_JOB_KINDS.SECOND_ESCALATION) {
      const updated = await this.prisma.followUp.updateMany({
        where: {
          id: followUp.id,
          tenantId: followUp.tenantId,
          done: false,
          escalatedAt: { not: null },
          secondEscalatedAt: null,
        },
        data: {
          secondEscalatedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        return;
      }
    }

    const notification = await this.createNotification({
      tenantId: followUp.tenantId,
      followUpId: followUp.id,
      leadId: followUp.leadId,
      branchId: followUp.lead.branchId,
      userId: recipient.id,
      type: kind,
      title: this.notificationTitle(kind),
      message: this.notificationMessage(kind, followUp.lead.name, followUp.purposeLabelSnapshot),
    });

    if (!notification) {
      return;
    }

    await this.realtimePublisher.publishNotification(notification);
    await this.publishInvalidations({
      tenantId: job.data.tenantId,
      branchId: followUp.lead.branchId ?? undefined,
      leadId: followUp.leadId,
      reason: this.invalidationReason(kind),
    });
  }

  private resolveJobKind(job: Job<FollowupNotificationJob>): FollowupNotificationJobKind | null {
    if (
      job.data.kind === FOLLOWUP_NOTIFICATION_JOB_KINDS.REMINDER
      || job.data.kind === FOLLOWUP_NOTIFICATION_JOB_KINDS.ESCALATION
      || job.data.kind === FOLLOWUP_NOTIFICATION_JOB_KINDS.SECOND_ESCALATION
    ) {
      return job.data.kind;
    }

    if (job.name === FOLLOWUP_NOTIFICATION_JOB_NAMES.REMINDER || job.name === 'followup_reminder') {
      return FOLLOWUP_NOTIFICATION_JOB_KINDS.REMINDER;
    }

    if (job.name === FOLLOWUP_NOTIFICATION_JOB_NAMES.ESCALATION || job.name === 'followup_escalation') {
      return FOLLOWUP_NOTIFICATION_JOB_KINDS.ESCALATION;
    }

    if (
      job.name === FOLLOWUP_NOTIFICATION_JOB_NAMES.SECOND_ESCALATION
      || job.name === 'followup_second_escalation'
    ) {
      return FOLLOWUP_NOTIFICATION_JOB_KINDS.SECOND_ESCALATION;
    }

    return null;
  }

  private async resolvePrimaryRecipient(followUp: {
    tenantId: string;
    id: string;
    assignedTo: string | null;
    lead: { ownerId: string | null };
  }): Promise<{ id: string } | null> {
    const recipientId = followUp.assignedTo ?? followUp.lead.ownerId;
    if (!recipientId) {
      return null;
    }

    const recipient = await this.prisma.user.findFirst({
      where: {
        id: recipientId,
        tenantId: followUp.tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!recipient) {
      this.logger.log(`Skipping follow-up ${followUp.id}: recipient ${recipientId} missing`);
      return null;
    }

    return recipient;
  }

  private async resolveSecondEscalationRecipient(
    tenantId: string,
    branchId: string | null,
  ): Promise<{ id: string } | null> {
    if (branchId) {
      const branchAdmin = await this.prisma.user.findFirst({
        where: {
          tenantId,
          status: 'ACTIVE',
          isTenantAdmin: true,
          defaultBranchId: branchId,
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
        },
      });

      if (branchAdmin) {
        return branchAdmin;
      }
    }

    return this.prisma.user.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        isTenantAdmin: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
      },
    });
  }

  private notificationTitle(kind: FollowupNotificationJobKind): string {
    if (kind === FOLLOWUP_NOTIFICATION_JOB_KINDS.REMINDER) {
      return 'Follow-up due soon';
    }

    if (kind === FOLLOWUP_NOTIFICATION_JOB_KINDS.SECOND_ESCALATION) {
      return 'Follow-up escalated to admin';
    }

    return 'Follow-up overdue';
  }

  private notificationMessage(
    kind: FollowupNotificationJobKind,
    leadName: string,
    purposeLabel: string | null,
  ): string {
    const purposeText = purposeLabel ? ` for ${purposeLabel}` : '';

    if (kind === FOLLOWUP_NOTIFICATION_JOB_KINDS.REMINDER) {
      return `Follow-up${purposeText} for ${leadName} is due soon.`;
    }

    if (kind === FOLLOWUP_NOTIFICATION_JOB_KINDS.SECOND_ESCALATION) {
      return `Follow-up${purposeText} for ${leadName} is still open and now requires admin attention.`;
    }

    return `Follow-up${purposeText} for ${leadName} is overdue and still open.`;
  }

  private invalidationReason(kind: FollowupNotificationJobKind): string {
    if (kind === FOLLOWUP_NOTIFICATION_JOB_KINDS.REMINDER) {
      return 'followup.due';
    }

    if (kind === FOLLOWUP_NOTIFICATION_JOB_KINDS.SECOND_ESCALATION) {
      return 'followup.second_escalated';
    }

    return 'followup.escalated';
  }

  private async createNotification(input: {
    tenantId: string;
    userId: string;
    branchId: string | null;
    leadId: string;
    followUpId: string;
    type: FollowupNotificationJobKind;
    title: string;
    message: string;
  }): Promise<Notification | null> {
    try {
      const created = await this.prisma.notification.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          branchId: input.branchId,
          leadId: input.leadId,
          followUpId: input.followUpId,
          type: input.type,
          title: input.title,
          message: input.message,
        },
      });

      return created as Notification;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }

      throw error;
    }
  }

  private async publishInvalidations(input: {
    tenantId: string;
    branchId?: string;
    leadId: string;
    reason: string;
  }): Promise<void> {
    await this.realtimePublisher.publishInvalidation({
      event: REALTIME_INVALIDATION_EVENTS.TODAY_INVALIDATE,
      tenantId: input.tenantId,
      branchId: input.branchId,
      leadId: input.leadId,
      reason: input.reason,
      occurredAt: new Date().toISOString(),
      source: 'worker',
    });
    await this.realtimePublisher.publishInvalidation({
      event: REALTIME_INVALIDATION_EVENTS.LEAD_DETAIL_INVALIDATE,
      tenantId: input.tenantId,
      branchId: input.branchId,
      leadId: input.leadId,
      reason: input.reason,
      occurredAt: new Date().toISOString(),
      source: 'worker',
    });
  }
}
