import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { QueueModule } from '../queue/queue.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { MilestoneRulesService } from './milestone-rules.service';

@Module({
  imports: [QueueModule, EventsModule, RealtimeModule],
  controllers: [LeadsController],
  providers: [LeadsService, MilestoneRulesService],
  exports: [LeadsService],
})
export class LeadsModule {}
