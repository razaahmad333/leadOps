import { BadRequestException, Injectable } from '@nestjs/common';
import { WebsiteFormIntakeDto } from '@leadops/shared';
import { LeadsService } from '../leads/leads.service';
import { WebsiteFormAdapter } from './adapters/inbound/website-form.adapter';
import { WebhookIdempotencyService } from './webhook-idempotency.service';
import { getTenantContext } from '../tenant/tenant.store';

@Injectable()
export class IntakeService {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly websiteAdapter: WebsiteFormAdapter,
    private readonly idempotency: WebhookIdempotencyService,
  ) {}

  async intakeWebsiteForm(payload: WebsiteFormIntakeDto): Promise<{ created: boolean; leadId?: string }> {
    const tenant = getTenantContext();
    const scopedMessageId = payload.providerMessageId
      ? this.scopeMessageId(payload.providerMessageId, tenant?.tenantId)
      : null;

    if ((process.env.DEPLOYMENT_MODE ?? 'single') === 'multi' && (!tenant?.tenantId || tenant.tenantId === 'system')) {
      throw new BadRequestException('Tenant context is required for website intake');
    }

    if (scopedMessageId) {
      const accepted = await this.idempotency.ensureNotProcessed({
        provider: 'website-form',
        messageId: scopedMessageId,
        tenantId: tenant?.tenantId,
        payload,
      });

      if (!accepted) {
        return { created: false };
      }
    }

    try {
      const lead = await this.leadsService.create(this.websiteAdapter.normalize(payload), {
        activityType: 'lead.intake.website',
        activityMessage: 'Lead created from website form intake',
      });

      if (scopedMessageId) {
        await this.idempotency.markProcessed('website-form', scopedMessageId);
      }

      return { created: true, leadId: lead.id };
    } catch (error) {
      if (scopedMessageId) {
        await this.idempotency.markFailed('website-form', scopedMessageId);
      }
      throw error;
    }
  }

  private scopeMessageId(messageId: string, tenantId: string | undefined): string {
    const normalized = messageId.trim();
    if (!normalized) {
      return '';
    }

    const scope = tenantId && tenantId !== 'system' ? tenantId : 'system';
    return `${scope}:${normalized}`;
  }
}
