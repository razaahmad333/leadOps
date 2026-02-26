export interface OutboundMessagingAdapter {
  provider: string;
  sendText(input: { to: string; text: string; tenantId: string }): Promise<{ messageId: string }>;
  sendTemplate(input: {
    to: string;
    templateKey: string;
    variables: Record<string, string>;
    tenantId: string;
  }): Promise<{ messageId: string }>;
}
