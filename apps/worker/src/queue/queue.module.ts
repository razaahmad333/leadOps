import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { REMINDER_QUEUE, REPORT_QUEUE } from '@leadops/shared';
import { ReminderProcessor } from './reminder.processor';
import { ReportProcessor } from './report.processor';
import { WorkerRealtimePublisherService } from './realtime-publisher.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
    BullModule.registerQueue({ name: REPORT_QUEUE }),
  ],
  providers: [ReminderProcessor, ReportProcessor, WorkerRealtimePublisherService],
})
export class QueueModule {}
