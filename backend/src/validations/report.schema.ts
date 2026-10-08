import { z } from 'zod';

const taskStatusSchema = z.enum(['todo', 'in_progress', 'finished']);

export const reportFiltersSchema = z
  .object({
    farmId: z.string().uuid('Please choose a valid farm.').optional(),
    status: taskStatusSchema.optional(),
    rangeDays: z.coerce.number().int().min(0).max(365).optional(),
  })
  .optional();

export const createReportSchema = z.object({
  reportType: z.enum(['tasks', 'workers', 'farms']),
  format: z.enum(['csv']).default('csv'),
  filters: reportFiltersSchema,
});

export const listReportsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});