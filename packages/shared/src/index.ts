export { LeadStatus, Role, ACTIVE_LEAD_STATUSES } from './enums';

export {
  DOMAIN_EVENTS,
  type LeadCreatedEvent,
  type StatusChangedEvent,
  type FollowupDueEvent,
  type ReportDeliveredEvent,
} from './events';

export {
  REMINDER_QUEUE,
  REPORT_QUEUE,
  type DailyReportJob,
  type FollowupReminderJob,
} from './queue';

export {
  LoginSchema,
  LoginResponseSchema,
  AuthUserSchema,
  type LoginDto,
  type LoginResponse,
  type AuthUser,
} from './schemas/auth.schema';

export {
  CreateLeadSchema,
  UpdateLeadStatusSchema,
  CreateLeadNoteSchema,
  LeadSchema,
  LeadDetailSchema,
  LeadActivitySchema,
  type CreateLeadDto,
  type UpdateLeadStatusDto,
  type CreateLeadNoteDto,
  type Lead,
  type LeadDetail,
  type LeadActivity,
} from './schemas/lead.schema';

export {
  CreateFollowUpSchema,
  FollowUpSchema,
  TodayFollowUpSchema,
  type CreateFollowUpDto,
  type FollowUp,
  type TodayFollowUp,
} from './schemas/followup.schema';

export {
  DashboardStatsSchema,
  type DashboardStats,
} from './schemas/dashboard.schema';

export {
  TenantSettingsSchema,
  type TenantSettings,
} from './schemas/settings.schema';

export {
  WebsiteFormIntakeSchema,
  type WebsiteFormIntakeDto,
} from './schemas/intake.schema';
