import { z } from 'zod';

const OptionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}, z.string().max(400).optional());

export const WebsiteFormIntakeSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  phone: OptionalTrimmedString,
  email: z.string().trim().email().max(254).optional(),
  message: z.string().trim().max(2000).optional(),
  sourcePage: OptionalTrimmedString,
  providerMessageId: OptionalTrimmedString,
}).strict();

export type WebsiteFormIntakeDto = z.infer<typeof WebsiteFormIntakeSchema>;
