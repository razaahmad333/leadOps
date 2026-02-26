import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { REMINDER_QUEUE, REPORT_QUEUE } from '@leadops/shared';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
    BullModule.registerQueue({ name: REPORT_QUEUE }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
