import { z } from 'zod';

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url('Please send a valid push endpoint.'),
  keys: z.object({
    p256dh: z.string().min(1, 'Please send the p256dh key.'),
    auth: z.string().min(1, 'Please send the auth key.'),
  }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().min(6, 'Please send a valid push endpoint.'),
});

export const pushSubscribeInput = pushSubscribeSchema;
export const pushUnsubscribeInput = pushUnsubscribeSchema;