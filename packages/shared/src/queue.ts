export const REMINDER_QUEUE = 'leadops-reminders';
export const REPORT_QUEUE = 'leadops-reports';

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

export type FollowupNotificationJobKind =
  typeof FOLLOWUP_NOTIFICATION_JOB_KINDS[keyof typeof FOLLOWUP_NOTIFICATION_JOB_KINDS];
export type FollowupNotificationJobName =
  typeof FOLLOWUP_NOTIFICATION_JOB_NAMES[keyof typeof FOLLOWUP_NOTIFICATION_JOB_NAMES];

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
