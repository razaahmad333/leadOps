import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { WebsiteFormAdapter } from './adapters/inbound/website-form.adapter';
import { WhatsAppInboundAdapter } from './adapters/inbound/whatsapp.adapter';
import { WhatsAppOutboundAdapter } from './adapters/outbound/whatsapp-outbound.adapter';
import { WebhookIdempotencyService } from './webhook-idempotency.service';

@Module({
  imports: [LeadsModule],
  controllers: [IntakeController],
  providers: [
    IntakeService,
    WebsiteFormAdapter,
    WhatsAppInboundAdapter,
    WhatsAppOutboundAdapter,
    WebhookIdempotencyService,
    RateLimitGuard,
  ],
})
export class IntegrationsModule {}
