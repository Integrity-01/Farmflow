import { z } from 'zod';

export const systemLoginSchema = z.object({
  adminId: z
    .string()
    .trim()
    .min(3, 'Please enter your System Administrator ID.')
    .max(40, 'That ID is too long.'),
  password: z.string().min(1, 'Please enter your password.').max(128),
});

export const systemVerifyMfaSchema = z.object({
  mfaToken: z.string().min(1, 'The verification session is missing.'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.'),
});

export const systemConfirmMfaSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.'),
});

export const systemDisableMfaSchema = z.object({
  password: z.string().min(1, 'Please enter your password.').max(128),
});

export const systemChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Please enter your current password.').max(128),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be shorter than 128 characters.'),
});

export const systemForgotPasswordSchema = z.object({
  email: z.email('Please enter a valid email address.'),
});

export const systemResetPasswordSchema = z.object({
  token: z.string().min(1, 'The reset token is missing.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be shorter than 128 characters.'),
});

export const systemUpdateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Please enter a full name.').max(160),
  email: z.email('Please enter a valid email address.').optional().nullable().or(z.literal('')),
});

const pageQuery = {
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
};

export const systemOrganizationsQuerySchema = z.object({
  search: z.string().trim().max(255).optional(),
  status: z.enum(['active', 'suspended', 'pending']).optional(),
  sort: z.enum(['created_at', 'name', 'status', 'member_count', 'farm_count', 'task_count']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  ...pageQuery,
});

export const systemUsersQuerySchema = z.object({
  search: z.string().trim().max(255).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  role: z.enum(['organization_administrator', 'farm_manager', 'supervisor', 'field_officer']).optional(),
  sort: z.enum(['created_at', 'name', 'email', 'last_login_at']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  ...pageQuery,
});

export const systemAuditQuerySchema = z.object({
  search: z.string().trim().max(255).optional(),
  action: z.string().trim().max(80).optional(),
  actorType: z.enum(['user', 'system_admin', 'system']).optional(),
  organizationId: z.string().trim().uuid('Invalid organization.').optional(),
  ...pageQuery,
});

export const systemAnalyticsQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', 'custom']).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export const systemCreateAdminSchema = z.object({
  name: z.string().trim().min(2, 'Please enter a full name.').max(160),
  email: z.email('Please enter a valid email address.').optional().nullable().or(z.literal('')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be shorter than 128 characters.')
    .optional(),
  isOwner: z.boolean().optional(),
});

export const systemAdminStatusSchema = z.object({
  status: z.enum(['active', 'disabled']),
});

export const systemAdminPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be shorter than 128 characters.'),
});
