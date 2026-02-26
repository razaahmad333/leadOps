export const REMINDER_QUEUE = 'leadops-reminders';
export const REPORT_QUEUE = 'leadops-reports';

export interface FollowupReminderJob {
  tenantId: string;
  followUpId: string;
}

export interface DailyReportJob {
  tenantId: string;
  reportDate: string;
}
