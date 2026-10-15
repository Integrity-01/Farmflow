import { z } from 'zod';

export const switchOrgSchema = z.object({
  orgId: z.string().trim().uuid('Invalid organization.'),
});

export const updateMemberSchema = z
  .object({
    roleId: z.string().trim().uuid('Invalid role.').optional(),
    status: z.enum(['active', 'suspended']).optional(),
  })
  .refine((value) => value.roleId !== undefined || value.status !== undefined, {
    message: 'Nothing to update.',
  });

export const rejectMemberSchema = z.object({
  reason: z.string().trim().max(255).optional(),
});

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  roleId: z.string().trim().uuid('Invalid role.'),
});

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(1, 'An invitation token is required.'),
});

export const joinOrgSchema = z.object({
  accessKey: z.string().trim().min(1, 'An access key is required.').max(200),
});

export const updateOrgSettingsSchema = z
  .object({
    selfJoin: z.enum(['open', 'approval']).optional(),
    defaultRole: z.string().trim().min(1).max(40).optional(),
  })
  .refine((value) => value.selfJoin !== undefined || value.defaultRole !== undefined, {
    message: 'Nothing to update.',
  });
