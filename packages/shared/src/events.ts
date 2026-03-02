export const DOMAIN_EVENTS = {
  LEAD_CREATED: 'lead.created',
  STATUS_CHANGED: 'status.changed',
  FOLLOWUP_DUE: 'followup.due',
  REPORT_DELIVERED: 'report.delivered',
} as const;

export interface LeadCreatedEvent {
  tenantId: string;
  leadId: string;
}

export interface StatusChangedEvent {
  tenantId: string;
  leadId: string;
  from: string;
  to: string;
  fromStageKey?: string | null;
  toStageKey?: string | null;
  milestone?: string;
}

export interface FollowupDueEvent {
  tenantId: string;
  leadId: string;
  followUpId: string;
}

export interface ReportDeliveredEvent {
  tenantId: string;
  reportDate: string;
}
