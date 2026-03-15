import { z } from 'zod';

const DateFromInput = z.preprocess((value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/^"|"$/g, '');
    return new Date(normalized);
  }
  return value;
}, z.date({ invalid_type_error: 'Invalid date', required_error: 'scheduledAt is required' }));

export const CreateFollowUpSchema = z.object({
  leadId: z.string().uuid('leadId must be a valid UUID'),
  scheduledAt: DateFromInput,
  assignedTo: z.string().uuid().optional(),
  purposeKey: z.string().trim().min(1).max(80),
  note: z.string().trim().max(1000).optional(),
}).strict();

export type CreateFollowUpDto = z.infer<typeof CreateFollowUpSchema>;

export const FollowUpSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  leadId: z.string(),
  kind: z.string(),
  purposeKey: z.string().nullable(),
  purposeLabel: z.string().nullable(),
  scheduledAt: z.coerce.date(),
  note: z.string().nullable(),
  done: z.boolean(),
  escalatedAt: z.coerce.date().nullable(),
  secondEscalatedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const TodayFollowUpSchema = FollowUpSchema.extend({
  lead: z.object({
    id: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    status: z.string(),
    branchId: z.string().nullable().optional(),
  }),
  assignedUser: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
});

const OptionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}, z.string().optional());

export const DueQueueStatusSchema = z.enum(['all', 'due_today', 'overdue', 'escalated']);

export const ListTodayFollowUpsQuerySchema = z.object({
  search: OptionalTrimmedString,
  branchId: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }, z.string().uuid().optional()),
  status: DueQueueStatusSchema.default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const TodayFollowUpListResponseSchema = z.object({
  items: z.array(TodayFollowUpSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(1),
});

export type FollowUp = z.infer<typeof FollowUpSchema>;
export type TodayFollowUp = z.infer<typeof TodayFollowUpSchema>;
export type DueQueueStatus = z.infer<typeof DueQueueStatusSchema>;
export type ListTodayFollowUpsQueryDto = z.infer<typeof ListTodayFollowUpsQuerySchema>;
export type TodayFollowUpListResponse = z.infer<typeof TodayFollowUpListResponseSchema>;
