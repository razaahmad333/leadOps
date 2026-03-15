import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  DailyReportJob,
  FOLLOWUP_NOTIFICATION_JOB_KINDS,
  FOLLOWUP_NOTIFICATION_JOB_NAMES,
  type FollowupNotificationJob,
  REMINDER_QUEUE,
  REPORT_QUEUE,
} from '@leadops/shared';
import { TenantConfigService } from '../tenant/tenant-config.service';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(REMINDER_QUEUE) private readonly reminderQueue: Queue<FollowupNotificationJob>,
    @InjectQueue(REPORT_QUEUE) private readonly reportQueue: Queue<DailyReportJob>,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.enqueueDailySummary({
      tenantId: 'demo',
      reportDate: new Date().toISOString().slice(0, 10),
    });
  }

  async scheduleFollowupNotifications(
    payload: Omit<FollowupNotificationJob, 'kind'>,
    scheduledAt: Date,
  ): Promise<void> {
    const rules = await this.tenantConfig.getFollowupRules(payload.tenantId);
    const reminderRunAt = new Date(
      Math.max(scheduledAt.getTime() - rules.firstReminderMinutes * 60_000, Date.now()),
    );
    const escalationRunAt = new Date(scheduledAt.getTime() + rules.escalationMinutes * 60_000);
    const secondEscalationRunAt = new Date(scheduledAt.getTime() + rules.escalationMinutes * 2 * 60_000);

    await Promise.all([
      this.enqueueFollowupJob(
        { ...payload, kind: FOLLOWUP_NOTIFICATION_JOB_KINDS.REMINDER },
        reminderRunAt,
      ),
      this.enqueueFollowupJob(
        { ...payload, kind: FOLLOWUP_NOTIFICATION_JOB_KINDS.ESCALATION },
        escalationRunAt,
      ),
      this.enqueueFollowupJob(
        { ...payload, kind: FOLLOWUP_NOTIFICATION_JOB_KINDS.SECOND_ESCALATION },
        secondEscalationRunAt,
      ),
    ]);
  }

  async cancelFollowupNotifications(followUpId: string): Promise<void> {
    await Promise.all([
      this.removeFollowupJob(followUpId, FOLLOWUP_NOTIFICATION_JOB_KINDS.REMINDER),
      this.removeFollowupJob(followUpId, FOLLOWUP_NOTIFICATION_JOB_KINDS.ESCALATION),
      this.removeFollowupJob(followUpId, FOLLOWUP_NOTIFICATION_JOB_KINDS.SECOND_ESCALATION),
    ]);
  }

  async rescheduleFollowupNotifications(
    payload: Omit<FollowupNotificationJob, 'kind'>,
    scheduledAt: Date,
  ): Promise<void> {
    this.logger.log(
      `Rescheduling follow-up notification jobs for ${payload.followUpId} (tenant=${payload.tenantId}) to ${scheduledAt.toISOString()}`,
    );
    await this.cancelFollowupNotifications(payload.followUpId);
    await this.scheduleFollowupNotifications(payload, scheduledAt);
  }

  async enqueueDailySummary(payload: DailyReportJob): Promise<void> {
    await this.reportQueue.add('daily-summary', payload, {
      removeOnComplete: true,
      removeOnFail: 200,
      jobId: `summary-${payload.tenantId}-${payload.reportDate}`,
    });

    this.logger.log(`Queued daily summary for ${payload.tenantId} (${payload.reportDate})`);
  }

  private async enqueueFollowupJob(payload: FollowupNotificationJob, runAt: Date): Promise<void> {
    const delay = Math.max(runAt.getTime() - Date.now(), 0);
    const jobId = this.followupNotificationJobId(payload.followUpId, payload.kind);
    const jobName = payload.kind === FOLLOWUP_NOTIFICATION_JOB_KINDS.REMINDER
      ? FOLLOWUP_NOTIFICATION_JOB_NAMES.REMINDER
      : payload.kind === FOLLOWUP_NOTIFICATION_JOB_KINDS.ESCALATION
        ? FOLLOWUP_NOTIFICATION_JOB_NAMES.ESCALATION
        : FOLLOWUP_NOTIFICATION_JOB_NAMES.SECOND_ESCALATION;

    await this.reminderQueue.add(jobName, payload, {
      delay,
      removeOnComplete: true,
      removeOnFail: 200,
      jobId,
    });

    this.logger.log(
      `Queued ${payload.kind} job ${jobId} for tenant ${payload.tenantId} at ${runAt.toISOString()} (delayMs=${delay})`,
    );
  }

  private async removeFollowupJob(
    followUpId: string,
    kind: FollowupNotificationJob['kind'],
  ): Promise<void> {
    const jobId = this.followupNotificationJobId(followUpId, kind);

    try {
      const removedCount = await this.reminderQueue.remove(jobId);

      if (removedCount > 0) {
        this.logger.log(`Canceled follow-up job ${jobId}`);
      } else {
        this.logger.log(`Follow-up job ${jobId} was not found to cancel`);
      }
    } catch (error: unknown) {
      this.logger.debug(`Unable to cancel ${kind} job for follow-up ${followUpId}: ${(error as Error).message}`);
    }
  }

  private followupNotificationJobId(
    followUpId: string,
    kind: FollowupNotificationJob['kind'],
  ): string {
    return `followup-${followUpId}-${kind.toLowerCase()}`;
  }
}
