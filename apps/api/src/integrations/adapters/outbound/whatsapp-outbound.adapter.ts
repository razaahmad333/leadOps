import { Injectable } from '@nestjs/common';
import { OutboundMessagingAdapter } from './outbound-adapter.interface';

@Injectable()
export class WhatsAppOutboundAdapter implements OutboundMessagingAdapter {
  provider = 'whatsapp';

  async sendText(): Promise<{ messageId: string }> {
    throw new Error('WhatsApp outbound adapter is scaffolded only (v1 non-goal)');
  }

  async sendTemplate(): Promise<{ messageId: string }> {
    throw new Error('WhatsApp outbound adapter is scaffolded only (v1 non-goal)');
  }
}
