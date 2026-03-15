import { z } from 'zod';

export const NotificationTypeSchema = z.enum([
  'FOLLOWUP_REMINDER',
  'FOLLOWUP_ESCALATION',
  'FOLLOWUP_SECOND_ESCALATION',
]);
export const NotificationStatusSchema = z.enum(['all', 'unread', 'read']);

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  branchId: z.string().uuid().nullable(),
  leadId: z.string().uuid(),
  followUpId: z.string().uuid(),
  type: NotificationTypeSchema,
  title: z.string(),
  message: z.string(),
  readAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export const ListNotificationsQuerySchema = z.object({
  status: NotificationStatusSchema.default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(8),
}).strict();

export const NotificationListResponseSchema = z.object({
  items: z.array(NotificationSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(1),
});

export const UnreadNotificationCountSchema = z.object({
  count: z.number().int().min(0),
}).strict();

export const MarkNotificationReadSchema = z.object({
  notificationId: z.string().uuid(),
}).strict();

export const NotificationMutationResultSchema = z.object({
  success: z.boolean(),
}).strict();

export type NotificationType = z.infer<typeof NotificationTypeSchema>;
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type ListNotificationsQueryDto = z.infer<typeof ListNotificationsQuerySchema>;
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;
export type UnreadNotificationCount = z.infer<typeof UnreadNotificationCountSchema>;
export type MarkNotificationReadDto = z.infer<typeof MarkNotificationReadSchema>;
export type NotificationMutationResult = z.infer<typeof NotificationMutationResultSchema>;
