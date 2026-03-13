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
  name: z.string().trim().min(1, 'Name is required').max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').optional(),
  source: z.string().trim().max(100).optional(),
  ownerId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  stageKey: z.string().trim().min(1).max(80).optional(),
  intakeData: z.record(z.unknown()).optional(),
  nextFollowUpAt: DateFromInput,
  note: z.string().trim().max(1000).optional(),
}).strict();

export type CreateLeadDto = z.infer<typeof CreateLeadSchema>;

export const UpdateLeadStatusSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  stageKey: z.string().trim().min(1).max(80).optional(),
  nextFollowUpAt: DateFromInput.optional(),
}).strict();

export type UpdateLeadStatusDto = z.infer<typeof UpdateLeadStatusSchema>;

export const CreateLeadNoteSchema = z.object({
  note: z.string().trim().min(1).max(1000),
}).strict();

export type CreateLeadNoteDto = z.infer<typeof CreateLeadNoteSchema>;

export const LeadSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  ownerId: z.string().nullable(),
  branchId: z.string().nullable().optional(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  source: z.string().nullable(),
  status: z.nativeEnum(LeadStatus),
  stageKey: z.string().nullable().optional(),
  intakeData: z.record(z.unknown()).nullable().optional(),
  nextFollowUpAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const OptionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}, z.string().optional());

export const ListLeadsQuerySchema = z.object({
  search: OptionalTrimmedString,
  stageKey: OptionalTrimmedString,
  branchId: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }, z.string().uuid().optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const LeadListResponseSchema = z.object({
  items: z.array(LeadSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(1),
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
      kind: z.string(),
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
export type ListLeadsQueryDto = z.infer<typeof ListLeadsQuerySchema>;
export type LeadListResponse = z.infer<typeof LeadListResponseSchema>;
