import { z } from 'zod';

export const recurrenceFrequencySchema = z.enum(['daily', 'weekly', 'monthly']);

const nullableUuid = z.preprocess(
  (value) => (value === '' || value === null ? null : value),
  z.string().uuid('Please choose a valid worker.').nullable().optional(),
);

const nullableDayOfMonth = z.preprocess(
  (value) => (value === '' || value === null ? null : value),
  z.number().int().min(1).max(31).nullable().optional(),
);

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const shared = {
  title: z
    .string()
    .trim()
    .min(2, 'Please enter a title.')
    .max(200, 'Title must be shorter than 200 characters.'),
  description: z.string().trim().max(5000, 'Description is too long.').optional().nullable(),
  farmId: z.string().uuid('Please choose a farm.'),
  fieldId: nullableUuid,
  categoryId: z.string().uuid('Please choose a category.'),
  assignedTo: nullableUuid,
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  frequency: recurrenceFrequencySchema,
  intervalCount: z.coerce.number().int().min(1).max(1000),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  dayOfMonth: nullableDayOfMonth,
  startTimeMinutes: z.coerce.number().int().min(0).max(1439),
  estimatedDurationMinutes: z.coerce.number().int().min(1).max(10080).optional().nullable(),
  reminderOffsetMinutes: z.coerce.number().int().min(0).max(20160).optional().nullable(),
  startDate: z
    .string()
    .regex(datePattern, 'Pick a start date.')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Pick a valid start date.'),
  endDate: z
    .preprocess(
      (value) => (value === '' || value === null ? null : value),
      z.string().regex(datePattern, 'Pick a valid end date.').nullable().optional(),
    )
    .refine((value) => value === null || value === undefined || !Number.isNaN(Date.parse(value)), {
      message: 'Pick a valid end date.',
      path: ['endDate'],
    }),
} as const;

function scheduleRefinement(
  data: {
    frequency?: string;
    dayOfMonth?: number | null;
    startDate?: string;
    endDate?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (data.frequency === 'monthly' && (data.dayOfMonth ?? null) === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['dayOfMonth'],
      message: 'Pick a day of the month.',
    });
  }
  if (data.endDate && data.startDate && data.endDate < data.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'The end date must be after the start date.',
    });
  }
}

export const recurringTaskSchema = z
  .object({
    ...shared,
    priority: shared.priority.default('medium'),
    frequency: shared.frequency.default('weekly'),
    intervalCount: shared.intervalCount.default(1),
    weekdays: shared.weekdays.default([]),
    startTimeMinutes: shared.startTimeMinutes.default(420),
    active: z.boolean().default(true),
  })
  .superRefine(scheduleRefinement);

export const recurringTaskUpdateSchema = z.object(shared).partial().superRefine(scheduleRefinement);