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

export const ACTIVE_LEAD_STATUSES: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.PENDING,
];
