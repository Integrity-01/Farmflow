import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  APP_TIMEZONE: z.string().default('UTC'),
  APP_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1).default(''),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('farmflow'),
  JWT_SECRET: z
    .string()
    .min(32)
    .default('dev-only-secret-change-me-in-production-0123456789'),
  EMAIL_PROVIDER: z
    .enum(['smtp', 'resend', 'sendgrid', 'ses'])
    .default('smtp'),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z
    .string()
    .default('FarmFlow <no-reply@farmflow.example>'),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().int().positive().optional(),
  EMAIL_SECURE: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  STORAGE_URL: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  console.error(`Invalid environment configuration. ${details}`);
  process.exit(1);
}

export const env = parsed.data;