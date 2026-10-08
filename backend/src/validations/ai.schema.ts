import { z } from 'zod';

export const chatHistoryItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1, 'A message cannot be empty.').max(2000, 'A message is too long.'),
});

export const chatSchema = z.object({
  message: z.string().trim().min(1, 'Please enter a message.').max(2000, 'Message is too long.'),
  history: z.array(chatHistoryItemSchema).max(12, 'Too much history.').default([]),
});

export const suggestSchema = z.object({
  farmId: z.string().uuid('Please choose a valid farm.').optional(),
});