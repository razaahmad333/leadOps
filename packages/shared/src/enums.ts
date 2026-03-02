export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  PENDING = 'PENDING',
  WON = 'WON',
  LOST = 'LOST',
}

export enum Role {
  OWNER = 'OWNER',
  STAFF = 'STAFF',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum BranchScopeType {
  ALL_BRANCHES = 'ALL_BRANCHES',
  SELECTED = 'SELECTED',
}

export enum IndustryPreset {
  GENERIC = 'GENERIC',
  DIAGNOSTICS_LAB = 'DIAGNOSTICS_LAB',
}

export enum MilestoneKey {
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  SAMPLE_COLLECTED = 'SAMPLE_COLLECTED',
  REPORT_DELIVERED = 'REPORT_DELIVERED',
  MILESTONE_REPORT_DELIVERED = 'MILESTONE_REPORT_DELIVERED',
}

export const ACTIVE_LEAD_STATUSES: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.PENDING,
];
