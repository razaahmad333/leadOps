import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PingJobData } from './ping.processor';
import { PING_QUEUE } from './queue.constants';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(PING_QUEUE) private readonly pingQueue: Queue<PingJobData>,
  ) {}

  async onModuleInit(): Promise<void> {
    // Demo: add one ping job on startup to prove queue infrastructure works
    await this.addPingJob('startup-ping');
    this.logger.log('Startup ping job added to queue');
  }

  async addPingJob(message: string): Promise<void> {
    await this.pingQueue.add('ping', {
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
