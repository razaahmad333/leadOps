export const REMINDER_QUEUE = 'leadops-reminders';
export const REPORT_QUEUE = 'leadops-reports';
export const ANALYTICS_QUEUE = 'leadops-analytics';

export const FOLLOWUP_NOTIFICATION_JOB_KINDS = {
  REMINDER: 'FOLLOWUP_REMINDER',
  ESCALATION: 'FOLLOWUP_ESCALATION',
  SECOND_ESCALATION: 'FOLLOWUP_SECOND_ESCALATION',
} as const;

export const FOLLOWUP_NOTIFICATION_JOB_NAMES = {
  REMINDER: 'followup-reminder',
  ESCALATION: 'followup-escalation',
  SECOND_ESCALATION: 'followup-second-escalation',
} as const;

export const DASHBOARD_ANALYTICS_JOB_KINDS = {
  REFRESH_BRANCH: 'DASHBOARD_REFRESH_BRANCH',
  REBUILD_TENANT: 'DASHBOARD_REBUILD_TENANT',
} as const;

export const DASHBOARD_ANALYTICS_JOB_NAMES = {
  REFRESH_BRANCH: 'dashboard.refresh.branch',
  REBUILD_TENANT: 'dashboard.rebuild.tenant',
} as const;

export type FollowupNotificationJobKind =
  typeof FOLLOWUP_NOTIFICATION_JOB_KINDS[keyof typeof FOLLOWUP_NOTIFICATION_JOB_KINDS];
export type FollowupNotificationJobName =
  typeof FOLLOWUP_NOTIFICATION_JOB_NAMES[keyof typeof FOLLOWUP_NOTIFICATION_JOB_NAMES];
export type DashboardAnalyticsJobKind =
  typeof DASHBOARD_ANALYTICS_JOB_KINDS[keyof typeof DASHBOARD_ANALYTICS_JOB_KINDS];
export type DashboardAnalyticsJobName =
  typeof DASHBOARD_ANALYTICS_JOB_NAMES[keyof typeof DASHBOARD_ANALYTICS_JOB_NAMES];

export interface FollowupNotificationJob {
  tenantId: string;
  followUpId: string;
  kind: FollowupNotificationJobKind;
}

export type FollowupReminderJob = FollowupNotificationJob;

export interface DailyReportJob {
  tenantId: string;
  reportDate: string;
}

export interface DashboardRefreshBranchJob {
  kind: typeof DASHBOARD_ANALYTICS_JOB_KINDS.REFRESH_BRANCH;
  tenantId: string;
  branchId: string | null;
  reason: string;
  occurredAt: string;
}

export interface DashboardRebuildTenantJob {
  kind: typeof DASHBOARD_ANALYTICS_JOB_KINDS.REBUILD_TENANT;
  tenantId: string;
  reason: string;
  occurredAt: string;
}

export type DashboardAnalyticsJob = DashboardRefreshBranchJob | DashboardRebuildTenantJob;
