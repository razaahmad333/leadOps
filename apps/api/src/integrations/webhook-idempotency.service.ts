import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhookIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureNotProcessed(input: {
    provider: string;
    messageId: string;
    tenantId?: string;
    payload: unknown;
  }): Promise<boolean> {
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(input.payload))
      .digest('hex');

    try {
      await this.prisma.webhookMessage.create({
        data: {
          tenantId: input.tenantId,
          provider: input.provider,
          messageId: input.messageId,
          payloadHash,
          status: 'RECEIVED',
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async markProcessed(provider: string, messageId: string): Promise<void> {
    await this.prisma.webhookMessage.update({
      where: { provider_messageId: { provider, messageId } },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
  }
}
