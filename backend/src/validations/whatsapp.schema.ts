import { z } from 'zod';

export const whatsappSendSchema = z.object({
  to: z
    .string()
    .trim()
    .min(7, 'Enter a full phone number (country code included).')
    .max(32, 'Phone number is too long.')
    .regex(/^\+?[0-9]+$/, 'Phone number can only contain digits and a leading +.'),
  message: z
    .string()
    .trim()
    .min(1, 'Message is required.')
    .max(1600, 'Message must be shorter than 1600 characters.'),
});