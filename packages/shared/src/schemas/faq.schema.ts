import { z } from 'zod';

export const FaqStatusSchema = z.enum(['OPEN', 'ANSWERED']);

export const FaqQuestionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid().nullable(),
  question: z.string(),
  answer: z.string().nullable(),
  status: FaqStatusSchema,
  answeredAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  askedBy: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  tenant: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  branch: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).nullable(),
  answeredBy: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).nullable(),
});

export const CreateFaqQuestionSchema = z.object({
  question: z.string().trim().min(1).max(2000),
}).strict();

export const AnswerFaqQuestionSchema = z.object({
  answer: z.string().trim().min(1).max(4000),
}).strict();

export const ListFaqQuestionsQuerySchema = z.object({
  status: z.enum(['all', 'open', 'answered']).default('all'),
  search: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }, z.string().max(200).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const FaqQuestionListResponseSchema = z.object({
  items: z.array(FaqQuestionSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(1),
});

export type FaqStatus = z.infer<typeof FaqStatusSchema>;
export type FaqQuestion = z.infer<typeof FaqQuestionSchema>;
export type CreateFaqQuestionDto = z.infer<typeof CreateFaqQuestionSchema>;
export type AnswerFaqQuestionDto = z.infer<typeof AnswerFaqQuestionSchema>;
export type ListFaqQuestionsQueryDto = z.infer<typeof ListFaqQuestionsQuerySchema>;
export type FaqQuestionListResponse = z.infer<typeof FaqQuestionListResponseSchema>;
