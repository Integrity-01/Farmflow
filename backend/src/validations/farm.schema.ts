import { z } from 'zod';

export const farmStatusSchema = z.enum(['active', 'inactive', 'archived']);
export const fieldStatusSchema = z.enum(['active', 'fallow', 'harvested', 'inactive']);
export const sizeUnitSchema = z.enum(['hectares', 'acres']).default('hectares');

const nullableUuid = z.preprocess(
  (value) => (value === '' || value === null ? null : value),
  z.string().uuid('Please choose a valid option.').nullable().optional(),
);

export const createFarmSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter a farm name.')
    .max(120, 'Farm name must be shorter than 120 characters.'),
  location: z.string().trim().max(255, 'Location is too long.').optional().nullable(),
  description: z.string().trim().max(2000, 'Description is too long.').optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  size: z.coerce.number().positive('Size must be a positive number.').max(1e8).optional().nullable(),
  sizeUnit: sizeUnitSchema,
  managerId: nullableUuid,
  status: farmStatusSchema.default('active'),
});

export const updateFarmSchema = z
  .object({
    name: z.string().trim().min(2, 'Please enter a farm name.').max(120),
    location: z.string().trim().max(255).optional().nullable(),
    description: z.string().trim().max(2000).optional().nullable(),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    size: z.coerce.number().positive().max(1e8).optional().nullable(),
    sizeUnit: sizeUnitSchema,
    managerId: nullableUuid,
    status: farmStatusSchema,
  })
  .partial();

export const createFieldSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Please enter a field name.')
      .max(120, 'Field name must be shorter than 120 characters.'),
    size: z.coerce.number().positive().max(1e8).optional().nullable(),
    sizeUnit: sizeUnitSchema,
    crop: z.string().trim().max(120, 'Crop is too long.').optional().nullable(),
    cropVariety: z.string().trim().max(120, 'Crop variety is too long.').optional().nullable(),
    plantingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.')
      .optional()
      .nullable(),
    expectedHarvestDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.')
      .optional()
      .nullable(),
    status: fieldStatusSchema.default('active'),
    notes: z.string().trim().max(2000, 'Notes are too long.').optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (
      data.plantingDate &&
      data.expectedHarvestDate &&
      data.expectedHarvestDate < data.plantingDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expectedHarvestDate'],
        message: 'Expected harvest must be after the planting date.',
      });
    }
  });

export const updateFieldSchema = z
  .object({
    name: z.string().trim().min(2, 'Please enter a field name.').max(120),
    size: z.coerce.number().positive().max(1e8).optional().nullable(),
    sizeUnit: sizeUnitSchema,
    crop: z.string().trim().max(120).optional().nullable(),
    cropVariety: z.string().trim().max(120).optional().nullable(),
    plantingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.')
      .optional()
      .nullable(),
    expectedHarvestDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.')
      .optional()
      .nullable(),
    status: fieldStatusSchema,
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .partial();

export const listFarmsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: farmStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});