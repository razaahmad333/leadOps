import { z } from 'zod';

export const CreateFollowUpSchema = z.object({
  leadId: z.string().min(1, 'leadId is required'),
  scheduledAt: z.coerce.date(),
  note: z.string().max(1000).optional(),
});

export type CreateFollowUpDto = z.infer<typeof CreateFollowUpSchema>;

export const FollowUpSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  leadId: z.string(),
  scheduledAt: z.coerce.date(),
  note: z.string().nullable(),
  done: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type FollowUp = z.infer<typeof FollowUpSchema>;
