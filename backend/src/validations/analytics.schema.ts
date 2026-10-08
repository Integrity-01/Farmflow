import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  rangeDays: z.coerce.number().int().min(0).max(365).default(30),
});