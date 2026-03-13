import { Injectable, Logger } from '@nestjs/common';
import type { RealtimeInvalidationEvent } from '@leadops/shared';
import { RealtimeInvalidationEventSchema } from '@leadops/shared';
import { RealtimeGateway } from './realtime.gateway';

export type PublishRealtimeInvalidationInput = Omit<RealtimeInvalidationEvent, 'occurredAt'> & {
  occurredAt?: string;
};

@Injectable()
export class RealtimePublisherService {
  private readonly logger = new Logger(RealtimePublisherService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  publishInvalidation(input: PublishRealtimeInvalidationInput): void {
    const parsed = RealtimeInvalidationEventSchema.safeParse({
      ...input,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
    });

    if (!parsed.success) {
      this.logger.warn(`Dropped invalid realtime invalidation payload (reason=${input.reason})`);
      return;
    }

    this.gateway.emitInvalidation(parsed.data);
  }
}
