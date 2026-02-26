import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class DomainEventsService {
  constructor(private readonly events: EventEmitter2) {}

  emit<TPayload extends Record<string, unknown>>(eventName: string, payload: TPayload): void {
    this.events.emit(eventName, payload);
  }
}
