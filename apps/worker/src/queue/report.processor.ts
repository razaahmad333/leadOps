import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { REPORT_QUEUE } from '@leadops/shared';

interface ReportJobData {
  tenantId: string;
  reportDate: string;
}

@Processor(REPORT_QUEUE)
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  async process(job: Job<ReportJobData>): Promise<void> {
    if (job.name !== 'daily-summary') {
      this.logger.log(`Skipping unknown report job: ${job.name}`);
      return;
    }

    this.logger.log(
      JSON.stringify({
        event: 'report.delivered',
        tenantId: job.data.tenantId,
        reportDate: job.data.reportDate,
        message: 'Daily report delivery placeholder',
      }),
    );
  }
}
