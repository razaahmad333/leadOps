import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  REALTIME_REDIS_CHANNEL,
  RealtimePubsubMessageSchema,
} from '@leadops/shared';
import Redis from 'ioredis';
import { RealtimePublisherService } from './realtime.publisher.service';

@Injectable()
export class RealtimeRedisBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeRedisBridgeService.name);
  private subscriber?: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly realtimePublisher: RealtimePublisherService,
  ) {}

  async onModuleInit(): Promise<void> {
    const host = this.config.get<string>('REDIS_HOST') ?? 'localhost';
    const port = parseInt(this.config.get<string>('REDIS_PORT') ?? '6379', 10);

    this.subscriber = new Redis({
      host,
      port,
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });

    this.subscriber.on('error', (error) => {
      this.logger.warn(`Realtime Redis subscriber error: ${error.message}`);
    });

    await this.subscriber.connect();
    await this.subscriber.subscribe(REALTIME_REDIS_CHANNEL);

    this.subscriber.on('message', (channel, message) => {
      if (channel !== REALTIME_REDIS_CHANNEL) {
        return;
      }

      this.handleRealtimeMessage(message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.subscriber) {
      return;
    }

    await this.subscriber.unsubscribe(REALTIME_REDIS_CHANNEL);
    await this.subscriber.quit();
    this.subscriber = undefined;
  }

  private handleRealtimeMessage(message: string): void {
    try {
      const parsedJson: unknown = JSON.parse(message);
      const parsedEvent = RealtimePubsubMessageSchema.safeParse(parsedJson);

      if (!parsedEvent.success) {
        this.logger.warn('Dropped invalid realtime pubsub payload');
        return;
      }

      if ('event' in parsedEvent.data) {
        this.realtimePublisher.publishInvalidation(parsedEvent.data);
        return;
      }

      this.realtimePublisher.publishNotification(parsedEvent.data);
    } catch (error) {
      this.logger.warn(
        `Failed to process realtime pubsub payload: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
