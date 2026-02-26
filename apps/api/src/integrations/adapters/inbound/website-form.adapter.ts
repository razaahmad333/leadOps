import { Injectable } from '@nestjs/common';
import { CreateLeadDto, WebsiteFormIntakeDto } from '@leadops/shared';
import { InboundLeadAdapter } from './inbound-adapter.interface';

@Injectable()
export class WebsiteFormAdapter implements InboundLeadAdapter<WebsiteFormIntakeDto> {
  channel = 'website';

  normalize(payload: WebsiteFormIntakeDto): CreateLeadDto {
    const nowPlusTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000);

    return {
      name: payload.fullName,
      phone: payload.phone,
      email: payload.email,
      source: payload.sourcePage ? `Website Form (${payload.sourcePage})` : 'Website Form',
      note: payload.message,
      nextFollowUpAt: nowPlusTwoHours,
    };
  }
}
