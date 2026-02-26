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

    await this.reminderQueue.add('followup-reminder', payload, {
      delay,
      removeOnComplete: true,
      removeOnFail: 200,
      jobId: `followup-${payload.followUpId}`,
    });
  }

  async enqueueDailySummary(payload: DailyReportJob): Promise<void> {
    await this.reportQueue.add('daily-summary', payload, {
      removeOnComplete: true,
      removeOnFail: 200,
      jobId: `summary-${payload.tenantId}-${payload.reportDate}`,
    });

    this.logger.log(`Queued daily summary for ${payload.tenantId} (${payload.reportDate})`);
  }
}
