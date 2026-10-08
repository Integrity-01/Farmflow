import { z } from 'zod';

export const inputTypeSchema = z.enum([
  'seed',
  'fertilizer',
  'pesticide',
  'herbicide',
  'fungicide',
  'feed',
  'fuel',
  'equipment',
  'tools',
  'other',
]);

export const createInputSchema = z.object({
  farmId: z.string().uuid('Please choose a valid farm.'),
  name: z
    .string()
    .trim()
    .min(2, 'Please enter an input name.')
    .max(120, 'Input name must be shorter than 120 characters.'),
  type: inputTypeSchema,
  unit: z.string().trim().min(1, 'Please choose a unit.').max(30, 'Unit is too long.'),
  quantity: z.coerce.number().nonnegative('Quantity must be 0 or more.').max(1e9).default(0),
  lowStockThreshold: z.coerce.number().nonnegative('Threshold must be 0 or more.').max(1e9).default(0),
  unitCost: z.coerce.number().nonnegative('Unit cost must be 0 or more.').max(1e9).optional().nullable(),
  supplier: z.string().trim().max(120, 'Supplier is too long.').optional().nullable(),
  notes: z.string().trim().max(2000, 'Notes are too long.').optional().nullable(),
});

export const updateInputSchema = z
  .object({
    name: z.string().trim().min(2, 'Please enter an input name.').max(120),
    type: inputTypeSchema,
    unit: z.string().trim().min(1, 'Please choose a unit.').max(30),
    quantity: z.coerce.number().nonnegative('Quantity must be 0 or more.').max(1e9),
    lowStockThreshold: z.coerce.number().nonnegative('Threshold must be 0 or more.').max(1e9),
    unitCost: z.coerce.number().nonnegative('Unit cost must be 0 or more.').max(1e9).optional().nullable(),
    supplier: z.string().trim().max(120).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .partial();

export const adjustInputSchema = z.object({
  change: z
    .number('Please enter a quantity.')
    .min(-1e9, 'Quantity is too large.')
    .max(1e9, 'Quantity is too large.')
    .refine((value) => value !== 0, 'The change must not be zero.'),
  note: z.string().trim().max(255, 'Note is too long.').optional(),
});

export const listInputsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  type: inputTypeSchema.optional(),
  stock: z.enum(['all', 'low', 'out']).default('all'),
  farmId: z.string().uuid('Please choose a valid farm.').optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});