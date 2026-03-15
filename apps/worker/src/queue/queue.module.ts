import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ANALYTICS_QUEUE, REMINDER_QUEUE, REPORT_QUEUE } from '@leadops/shared';
import { DashboardProjectionProcessor } from './dashboard-projection.processor';
import { ReminderProcessor } from './reminder.processor';
import { ReportProcessor } from './report.processor';
import { WorkerRealtimePublisherService } from './realtime-publisher.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
    BullModule.registerQueue({ name: REPORT_QUEUE }),
    BullModule.registerQueue({ name: ANALYTICS_QUEUE }),
  ],
  providers: [
    ReminderProcessor,
    ReportProcessor,
    DashboardProjectionProcessor,
    WorkerRealtimePublisherService,
  ],
})
export class QueueModule {}
