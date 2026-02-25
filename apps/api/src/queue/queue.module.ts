import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PingProcessor } from './ping.processor';
import { QueueService } from './queue.service';
import { PING_QUEUE } from './queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: PING_QUEUE }),
  ],
  providers: [PingProcessor, QueueService],
  exports: [QueueService],
})
export class QueueModule {}
