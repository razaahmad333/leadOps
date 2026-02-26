import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { QueueModule } from '../queue/queue.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [QueueModule, EventsModule],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
