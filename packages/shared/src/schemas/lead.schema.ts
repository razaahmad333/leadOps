import { z } from 'zod';
import { LeadStatus } from '../enums';

const DateFromInput = z.preprocess((value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/^"|"$/g, '');
    return new Date(normalized);
  }
  return value;
}, z.date({ invalid_type_error: 'Invalid date', required_error: 'nextFollowUpAt is required' }));

export const CreateLeadSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').optional(),
  source: z.string().max(100).optional(),
  ownerId: z.string().optional(),
  nextFollowUpAt: DateFromInput,
  note: z.string().max(1000).optional(),
});

export type CreateLeadDto = z.infer<typeof CreateLeadSchema>;

export const UpdateLeadStatusSchema = z.object({
  status: z.nativeEnum(LeadStatus),
  nextFollowUpAt: DateFromInput.optional(),
});

export type UpdateLeadStatusDto = z.infer<typeof UpdateLeadStatusSchema>;

export const CreateLeadNoteSchema = z.object({
  note: z.string().min(1).max(1000),
});

export type CreateLeadNoteDto = z.infer<typeof CreateLeadNoteSchema>;

export const LeadSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  ownerId: z.string().nullable(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  source: z.string().nullable(),
  status: z.nativeEnum(LeadStatus),
  nextFollowUpAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const LeadActivitySchema = z.object({
  id: z.string(),
  type: z.string(),
  message: z.string(),
  createdAt: z.coerce.date(),
  actor: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
});

export const LeadDetailSchema = z.object({
  lead: LeadSchema,
  followUps: z.array(
    z.object({
      id: z.string(),
      scheduledAt: z.coerce.date(),
      done: z.boolean(),
      note: z.string().nullable(),
      escalatedAt: z.coerce.date().nullable(),
    }),
  ),
  activities: z.array(LeadActivitySchema),
});

export type Lead = z.infer<typeof LeadSchema>;
export type LeadActivity = z.infer<typeof LeadActivitySchema>;
export type LeadDetail = z.infer<typeof LeadDetailSchema>;
