import { z } from 'zod';

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'finished']);
export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

const nullableUuid = z.preprocess(
  (value) => (value === '' || value === null ? null : value),
  z.string().uuid('Please choose a valid option.').nullable().optional(),
);

const nullableDateTime = z.preprocess(
  (value) => (value === '' || value === null ? null : value),
  z.string().datetime({ offset: true }).nullable().optional(),
);

function deadlineRefinement(data: { startAt?: string | null; deadlineAt?: string | null }, ctx: z.RefinementCtx) {
  if (data.startAt && data.deadlineAt && new Date(data.deadlineAt) < new Date(data.startAt)) {
    ctx.addIssue({
      code: 'custom',
      path: ['deadlineAt'],
      message: 'The deadline must be after the start time.',
    });
  }
}

const commonFields = {
  title: z.string().trim().min(2, 'Please enter a task title.').max(200, 'Title must be shorter than 200 characters.'),
  description: z.string().trim().max(5000, 'Description is too long.').optional().nullable(),
  farmId: z.string().uuid('Please choose a farm.'),
  fieldId: nullableUuid,
  categoryId: z.string().uuid('Please choose a category.'),
  assignedTo: nullableUuid,
  priority: taskPrioritySchema.default('medium'),
  startAt: nullableDateTime,
  deadlineAt: nullableDateTime,
  estimatedDurationMinutes: z.number().int().min(1).max(10080).optional().nullable(),
  reminderOffsetMinutes: z.number().int().min(0).max(20160).optional().nullable(),
} as const;

export const createTaskSchema = z
  .object({ ...commonFields, status: taskStatusSchema.default('todo'), progress: z.number().int().min(0).max(100).default(0) })
  .superRefine(deadlineRefinement);

export const updateTaskSchema = z
  .object({ ...commonFields, progress: z.number().int().min(0).max(100).optional() })
  .partial()
  .superRefine(deadlineRefinement);

export const listTasksQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  farmId: z.string().uuid().optional(),
  fieldId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  overdue: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment.').max(2000, 'Comment is too long.'),
});

export const setTaskStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'finished']),
  progress: z.number().int().min(0).max(100).optional(),
});