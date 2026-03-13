import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  DailyReportJob,
  FollowupReminderJob,
  REMINDER_QUEUE,
  REPORT_QUEUE,
} from '@leadops/shared';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(REMINDER_QUEUE) private readonly reminderQueue: Queue<FollowupReminderJob>,
    @InjectQueue(REPORT_QUEUE) private readonly reportQueue: Queue<DailyReportJob>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.enqueueDailySummary({
      tenantId: 'demo',
      reportDate: new Date().toISOString().slice(0, 10),
    });
  }

  async scheduleFollowupReminder(payload: FollowupReminderJob, runAt: Date): Promise<void> {
    const delay = Math.max(runAt.getTime() - Date.now(), 0);
    const jobId = this.followupReminderJobId(payload.followUpId);

    await this.reminderQueue.add('followup-reminder', payload, {
      delay,
      removeOnComplete: true,
      removeOnFail: 200,
      jobId,
    });

    this.logger.log(
      `Queued follow-up reminder ${jobId} for tenant ${payload.tenantId} at ${runAt.toISOString()} (delayMs=${delay})`,
    );
  }

  async cancelFollowupReminder(followUpId: string): Promise<void> {
    const jobId = this.followupReminderJobId(followUpId);

    try {
      const removedCount = await this.reminderQueue.remove(jobId);

      if (removedCount > 0) {
        this.logger.log(`Canceled follow-up reminder ${jobId}`);
      } else {
        this.logger.log(`Follow-up reminder ${jobId} was not found to cancel`);
      }
    } catch (error: unknown) {
      this.logger.debug(`Unable to cancel reminder for follow-up ${followUpId}: ${(error as Error).message}`);
    }
  }

  async rescheduleFollowupReminder(payload: FollowupReminderJob, runAt: Date): Promise<void> {
    this.logger.log(
      `Rescheduling follow-up reminder ${this.followupReminderJobId(payload.followUpId)} for tenant ${payload.tenantId} to ${runAt.toISOString()}`,
    );
    await this.cancelFollowupReminder(payload.followUpId);
    await this.scheduleFollowupReminder(payload, runAt);
  }

  async enqueueDailySummary(payload: DailyReportJob): Promise<void> {
    await this.reportQueue.add('daily-summary', payload, {
      removeOnComplete: true,
      removeOnFail: 200,
      jobId: `summary-${payload.tenantId}-${payload.reportDate}`,
    });

    this.logger.log(`Queued daily summary for ${payload.tenantId} (${payload.reportDate})`);
  }

  private followupReminderJobId(followUpId: string): string {
    return `followup-${followUpId}`;
  }
}
