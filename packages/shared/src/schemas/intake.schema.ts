import { z } from 'zod';

export const WebsiteFormIntakeSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  message: z.string().max(2000).optional(),
  sourcePage: z.string().optional(),
  providerMessageId: z.string().optional(),
});

export type WebsiteFormIntakeDto = z.infer<typeof WebsiteFormIntakeSchema>;
