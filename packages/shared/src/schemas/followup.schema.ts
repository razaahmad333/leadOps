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
  leadId: z.string().min(1, 'leadId is required'),
  scheduledAt: DateFromInput,
  assignedTo: z.string().optional(),
  note: z.string().max(1000).optional(),
});

export type CreateFollowUpDto = z.infer<typeof CreateFollowUpSchema>;

export const FollowUpSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  leadId: z.string(),
  kind: z.string(),
  scheduledAt: z.coerce.date(),
  note: z.string().nullable(),
  done: z.boolean(),
  escalatedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const TodayFollowUpSchema = FollowUpSchema.extend({
  lead: z.object({
    id: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    status: z.string(),
  }),
  assignedUser: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
});

export type FollowUp = z.infer<typeof FollowUpSchema>;
export type TodayFollowUp = z.infer<typeof TodayFollowUpSchema>;
