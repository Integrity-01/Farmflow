import { z } from 'zod';

export const listHistoryQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  action: z.string().trim().max(60).optional(),
  farmId: z.string().uuid('Please choose a valid farm.').optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});