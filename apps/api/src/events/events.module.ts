import { Module } from '@nestjs/common';
import { DomainEventsService } from './domain-events.service';
import { DomainEventsHandler } from './domain-events.handler';

@Module({
  providers: [DomainEventsService, DomainEventsHandler],
  exports: [DomainEventsService],
})
export class EventsModule {}
