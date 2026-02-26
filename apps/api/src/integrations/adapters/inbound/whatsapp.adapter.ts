import { Injectable } from '@nestjs/common';
import { InboundLeadAdapter } from './inbound-adapter.interface';

interface WhatsAppInboundPayload {
  providerMessageId: string;
  from: string;
  body: string;
}

@Injectable()
export class WhatsAppInboundAdapter implements InboundLeadAdapter<WhatsAppInboundPayload> {
  channel = 'whatsapp';

  normalize(payload: WhatsAppInboundPayload) {
    return {
      name: `WhatsApp ${payload.from}`,
      phone: payload.from,
      source: 'WhatsApp (scaffolded)',
      note: payload.body,
      nextFollowUpAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }
}
