import { CreateLeadDto } from '@leadops/shared';

export interface InboundLeadAdapter<TPayload> {
  channel: string;
  normalize(payload: TPayload): CreateLeadDto;
}
