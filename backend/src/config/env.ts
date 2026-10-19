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
  // Managed MySQL providers (Aiven, PlanetScale, RDS...) require TLS. Set
  // DB_SSL=true and optionally paste the provider CA into DB_SSL_CA (PEM text;
  // literal "\n" sequences are accepted). When no CA is supplied, set
  // DB_SSL_REJECT_UNAUTHORIZED=false to connect without verifying the chain.
  DB_SSL: z
    .string()
    .optional()
    .transform((value) => value === 'true' || value === '1'),
  DB_SSL_CA: z.string().optional(),
  DB_SSL_REJECT_UNAUTHORIZED: z
    .string()
    .optional()
    .transform((value) => value === undefined || (value !== 'false' && value !== '0')),
  // Refresh-cookie SameSite policy. "auto" uses "none" in production (required
  // when the web app and API live on different domains, e.g. Vercel + Render)
  // and "lax" in development.
  COOKIE_SAMESITE: z.enum(['auto', 'lax', 'strict', 'none']).default('auto'),
  JWT_SECRET: z
    .string()
    .min(32)
    .default('dev-only-secret-change-me-in-production-0123456789'),
  // Dedicated signing secret for the isolated system-administrator environment.
  // When unset it falls back to JWT_SECRET (dev convenience); production should
  // set a distinct value so the two token families can never be confused.
  SYSTEM_ADMIN_JWT_SECRET: z.string().min(32).optional(),
  SYSTEM_ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(8),
  SYSTEM_ADMIN_MFA_ISSUER: z.string().default('FarmFlow System'),
  SYSTEM_ADMIN_MAX_FAILED_LOGINS: z.coerce.number().int().positive().default(5),
  SYSTEM_ADMIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
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