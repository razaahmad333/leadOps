import { Injectable } from '@nestjs/common';
import { MilestoneKey } from '@leadops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { TenantConfigService } from '../tenant/tenant-config.service';

interface MilestoneRuleInput {
  tenantId: string;
  leadId: string;
  actorId?: string | null;
  milestone: MilestoneKey;
}

@Injectable()
export class MilestoneRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly queue: QueueService,
  ) {}

  async handleMilestone(input: MilestoneRuleInput): Promise<void> {
    const handlers: Partial<Record<MilestoneKey, () => Promise<void>>> = {
      [MilestoneKey.REPORT_DELIVERED]: async () => {
        await this.handleReportDelivered(input);
      },
      [MilestoneKey.MILESTONE_REPORT_DELIVERED]: async () => {
        await this.handleReportDelivered(input);
      },
    };

    const handler = handlers[input.milestone];
    if (!handler) {
      return;
    }

    await handler();
  }

  private async handleReportDelivered(input: MilestoneRuleInput): Promise<void> {
    const rules = await this.tenantConfig.getFollowupRules(input.tenantId);

    const dueAt = await this.tenantConfig.normalizeToBusinessWindow(
      new Date(Date.now() + rules.postReportFollowupDays * 24 * 60 * 60 * 1000),
      input.tenantId,
    );

    const followUp = await this.prisma.followUp.create({
      data: {
        tenantId: input.tenantId,
        leadId: input.leadId,
        scheduledAt: dueAt,
        kind: 'POST_REPORT',
        note: rules.postReportFollowupNote,
      },
    });

    await this.prisma.lead.update({
      where: { id: input.leadId },
      data: {
        nextFollowUpAt: dueAt,
      },
    });

    await this.prisma.leadActivity.create({
      data: {
        tenantId: input.tenantId,
        leadId: input.leadId,
        actorId: input.actorId ?? null,
        type: 'lead.milestone.report_delivered',
        message: `Post-report follow-up scheduled for ${dueAt.toISOString()}`,
      },
    });

    await this.queue.scheduleFollowupReminder(
      {
        tenantId: input.tenantId,
        followUpId: followUp.id,
      },
      dueAt,
    );
  }
}
