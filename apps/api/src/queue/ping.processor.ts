import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PING_QUEUE } from './queue.module';

export interface PingJobData {
  message: string;
  timestamp: string;
}

@Processor(PING_QUEUE)
export class PingProcessor extends WorkerHost {
  private readonly logger = new Logger(PingProcessor.name);

  async process(job: Job<PingJobData>): Promise<{ pong: string }> {
    this.logger.log(`Processing ping job #${job.id}: "${job.data.message}"`);
    // Simulate a brief task
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { pong: job.data.message };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<PingJobData>): void {
    this.logger.log(`Ping job #${job.id} completed ✓`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PingJobData>, error: Error): void {
    this.logger.error(`Ping job #${job.id} failed: ${error.message}`);
  }
}
