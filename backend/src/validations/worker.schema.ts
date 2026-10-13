import { z } from 'zod';

export const workerStatusSchema = z.enum(['active', 'inactive', 'suspended']);

const nullableUuid = z.preprocess(
  (value) => (value === '' || value === null ? null : value),
  z.string().uuid('Please choose a valid option.').nullable().optional(),
);

export const createWorkerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter a worker name.')
    .max(120, 'Name must be shorter than 120 characters.'),
  phone: z.string().trim().max(30, 'Phone number is too long.').optional().nullable(),
  email: z.email('Please enter a valid email address.').optional().nullable(),
  position: z.string().trim().max(60, 'Position is too long.').optional().nullable(),
  userId: nullableUuid,
  farmId: nullableUuid,
  fieldId: nullableUuid,
  skills: z
    .array(z.string().trim().min(1).max(60, 'Skills must be shorter than 60 characters.'))
    .max(12, 'Too many skills. Keep it to 12.')
    .default([]),
  status: workerStatusSchema.default('active'),
  joinedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.')
    .optional()
    .nullable(),
});

export const updateWorkerSchema = z
  .object({
    name: z.string().trim().min(2, 'Please enter a worker name.').max(120),
    phone: z.string().trim().max(30).optional().nullable(),
    email: z.email('Please enter a valid email address.').optional().nullable(),
    position: z.string().trim().max(60).optional().nullable(),
    userId: nullableUuid,
    farmId: nullableUuid,
    fieldId: nullableUuid,
    skills: z
      .array(z.string().trim().min(1).max(60))
      .max(12)
      .optional(),
    status: workerStatusSchema,
    joinedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.').optional().nullable(),
  })
  .partial();

export const listWorkersQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: workerStatusSchema.optional(),
  farmId: z.string().uuid('Please choose a valid farm.').optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});