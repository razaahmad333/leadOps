import { z } from 'zod';
import { LeadStatus } from '../enums';

export const CreateLeadSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').optional(),
  source: z.string().max(100).optional(),
});

export type CreateLeadDto = z.infer<typeof CreateLeadSchema>;

export const UpdateLeadStatusSchema = z.object({
  status: z.nativeEnum(LeadStatus),
});

export type UpdateLeadStatusDto = z.infer<typeof UpdateLeadStatusSchema>;

export const LeadSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  source: z.string().nullable(),
  status: z.nativeEnum(LeadStatus),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Lead = z.infer<typeof LeadSchema>;
