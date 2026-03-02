import { Injectable } from '@nestjs/common';
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

    if (payload.providerMessageId) {
      const accepted = await this.idempotency.ensureNotProcessed({
        provider: 'website-form',
        messageId: payload.providerMessageId,
        tenantId: tenant?.tenantId,
        payload,
      });

      if (!accepted) {
        return { created: false };
      }
    }

    const lead = await this.leadsService.create(this.websiteAdapter.normalize(payload), {
      activityType: 'lead.intake.website',
      activityMessage: 'Lead created from website form intake',
    });

    if (payload.providerMessageId) {
      await this.idempotency.markProcessed('website-form', payload.providerMessageId);
    }

    return { created: true, leadId: lead.id };
  }
}
