import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ANALYTICS_QUEUE, REMINDER_QUEUE, REPORT_QUEUE } from '@leadops/shared';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
    BullModule.registerQueue({ name: REPORT_QUEUE }),
    BullModule.registerQueue({ name: ANALYTICS_QUEUE }),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
