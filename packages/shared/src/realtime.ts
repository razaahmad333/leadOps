import { z } from 'zod';

export const REALTIME_REDIS_CHANNEL = 'leadops:realtime:events';

export const REALTIME_INVALIDATION_EVENTS = {
  LEADS_INVALIDATE: 'leads.invalidate',
  LEAD_DETAIL_INVALIDATE: 'lead.detail.invalidate',
  TODAY_INVALIDATE: 'today.invalidate',
} as const;

export const REALTIME_SOCKET_SERVER_EVENTS = {
  INVALIDATION: 'realtime.invalidation',
} as const;

export const REALTIME_SOCKET_CLIENT_EVENTS = {
  SET_BRANCH: 'realtime.branch.set',
  SUBSCRIBE_LEAD: 'realtime.lead.subscribe',
  UNSUBSCRIBE_LEAD: 'realtime.lead.unsubscribe',
} as const;

const RealtimeInvalidationEventEnum = z.enum([
  REALTIME_INVALIDATION_EVENTS.LEADS_INVALIDATE,
  REALTIME_INVALIDATION_EVENTS.LEAD_DETAIL_INVALIDATE,
  REALTIME_INVALIDATION_EVENTS.TODAY_INVALIDATE,
]);

const RealtimeEventSourceEnum = z.enum(['api', 'worker']);

export const RealtimeInvalidationEventSchema = z.object({
  event: RealtimeInvalidationEventEnum,
  tenantId: z.string().min(1),
  branchId: z.string().min(1).optional(),
  leadId: z.string().min(1).optional(),
  reason: z.string().min(1),
  occurredAt: z.string().datetime(),
  source: RealtimeEventSourceEnum,
});

export const RealtimeBranchSelectionSchema = z.object({
  branchId: z.string().min(1).nullable().optional(),
});

export const RealtimeLeadSubscriptionSchema = z.object({
  leadId: z.string().min(1),
});

export type RealtimeInvalidationEventName = z.infer<typeof RealtimeInvalidationEventEnum>;
export type RealtimeEventSource = z.infer<typeof RealtimeEventSourceEnum>;
export type RealtimeInvalidationEvent = z.infer<typeof RealtimeInvalidationEventSchema>;
export type RealtimeBranchSelection = z.infer<typeof RealtimeBranchSelectionSchema>;
export type RealtimeLeadSubscription = z.infer<typeof RealtimeLeadSubscriptionSchema>;
