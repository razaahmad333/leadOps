import { Injectable, Logger } from '@nestjs/common';
import type { Notification, RealtimeInvalidationEvent } from '@leadops/shared';
import {
  NotificationSchema,
  REALTIME_INVALIDATION_EVENTS,
  RealtimeInvalidationEventSchema,
} from '@leadops/shared';
import { QueueService } from '../queue/queue.service';
import { RealtimeGateway } from './realtime.gateway';

export type PublishRealtimeInvalidationInput = Omit<RealtimeInvalidationEvent, 'occurredAt'> & {
  occurredAt?: string;
};

@Injectable()
export class RealtimePublisherService {
  private readonly logger = new Logger(RealtimePublisherService.name);

  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly queue: QueueService,
  ) {}

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

    if (
      parsed.data.event === REALTIME_INVALIDATION_EVENTS.LEADS_INVALIDATE
      || parsed.data.event === REALTIME_INVALIDATION_EVENTS.TODAY_INVALIDATE
    ) {
      void this.queue.enqueueDashboardBranchRefresh({
        tenantId: parsed.data.tenantId,
        branchId: parsed.data.branchId ?? null,
        reason: parsed.data.reason,
        occurredAt: parsed.data.occurredAt,
      });
    }
  }

  publishNotification(input: Notification): void {
    const parsed = NotificationSchema.safeParse(input);

    if (!parsed.success) {
      this.logger.warn('Dropped invalid realtime notification payload');
      return;
    }

    this.gateway.emitNotification(parsed.data);
  }
}
