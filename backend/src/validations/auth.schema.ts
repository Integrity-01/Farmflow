import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter a full name.')
    .max(120, 'Name must be shorter than 120 characters.'),
  email: z.email('Please enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be shorter than 128 characters.'),
  phone: z
    .string()
    .trim()
    .max(30, 'Phone number is too long.')
    .optional()
    .nullable()
    .or(z.literal('')),
  organizationId: z.string().trim().uuid('Invalid organization.'),
  accessKey: z.string().trim().min(1, 'An organization key is required.').max(200),
});

export const loginSchema = z.object({
  email: z.email('Please enter a valid email address.'),
  password: z.string().min(1, 'Please enter your password.'),
  organizationId: z.string().trim().uuid('Invalid organization.'),
  accessKey: z.string().trim().min(1, 'An organization key is required.').max(200),
});

export const verifyOrganizationKeySchema = z.object({
  accessKey: z.string().trim().min(1, 'An organization key is required.').max(200),
});

export const createOrganizationSchema = z.object({
  organizationName: z.string().trim().min(2, 'Enter an organization name.').max(255),
  name: z.string().trim().min(2, 'Please enter a full name.').max(120),
  email: z.email('Please enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  phone: z.string().trim().max(30, 'Phone number is too long.').optional().nullable().or(z.literal('')),
});

export const forgotPasswordSchema = z.object({
  email: z.email('Please enter a valid email address.'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'The reset token is missing.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be shorter than 128 characters.'),
});