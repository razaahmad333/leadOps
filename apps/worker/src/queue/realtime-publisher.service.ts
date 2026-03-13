import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  REALTIME_REDIS_CHANNEL,
  RealtimeInvalidationEvent,
} from '@leadops/shared';
import Redis from 'ioredis';

@Injectable()
export class WorkerRealtimePublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(WorkerRealtimePublisherService.name);
  private readonly publisher: Redis;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('REDIS_HOST') ?? 'localhost';
    const port = parseInt(this.config.get<string>('REDIS_PORT') ?? '6379', 10);

    this.publisher = new Redis({
      host,
      port,
      maxRetriesPerRequest: null,
    });

    this.publisher.on('error', (error) => {
      this.logger.warn(`Realtime Redis publisher error: ${error.message}`);
    });
  }

  async publish(event: RealtimeInvalidationEvent): Promise<void> {
    try {
      await this.publisher.publish(REALTIME_REDIS_CHANNEL, JSON.stringify(event));
    } catch (error) {
      this.logger.warn(
        `Failed to publish realtime event (${event.event}): ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.publisher.quit();
  }
}
