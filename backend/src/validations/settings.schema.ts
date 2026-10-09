import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter your full name.')
    .max(120, 'Name must be shorter than 120 characters.'),
  phone: z.string().trim().max(30, 'Phone number is too long.').optional().nullable().or(z.literal('')),
});

export const updateNotificationPrefsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  taskAssignments: z.boolean().optional(),
  deadlineReminders: z.boolean().optional(),
  overdueAlerts: z.boolean().optional(),
  taskCompletions: z.boolean().optional(),
  dailySummary: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Please enter your current password.'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be shorter than 128 characters.'),
});