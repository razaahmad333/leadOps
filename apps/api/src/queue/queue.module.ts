import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PingProcessor } from './ping.processor';
import { QueueService } from './queue.service';

export const PING_QUEUE = 'ping-queue';

@Module({
  imports: [
    BullModule.registerQueue({ name: PING_QUEUE }),
  ],
  providers: [PingProcessor, QueueService],
  exports: [QueueService],
})
export class QueueModule {}
