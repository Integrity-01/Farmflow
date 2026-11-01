import type { ConnectionOptions } from 'mysql2';
import { env } from '../config/env.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', '']);

/**
 * TLS is forced on for managed/remote databases (any DATABASE_URL, or a
 * non-local DB_HOST) so Aiven et al. are never reached in plaintext. Local
 * servers stay unencrypted unless DB_SSL=true is set explicitly; DB_SSL=false
 * forces it off everywhere.
 */
export function sslEnabled(): boolean {
  if (env.DB_SSL !== undefined) return env.DB_SSL;
  if (env.DATABASE_URL) return true;
  return !LOCAL_HOSTS.has(env.DB_HOST.trim().toLowerCase());
}

export function buildSslConfig(): { rejectUnauthorized: boolean; ca?: string } | undefined {
  if (!sslEnabled()) return undefined;
  const ssl: { rejectUnauthorized: boolean; ca?: string } = {
    rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
  };
  // Managed providers ship a CA as a PEM file; when pasted into an env var the
  // newlines often arrive escaped, so normalise literal "\n" sequences.
  if (env.DB_SSL_CA) ssl.ca = env.DB_SSL_CA.replace(/\\n/g, '\n');
  return ssl;
}

/**
 * Shared MySQL connection settings for the pool and the standalone CLI scripts.
 * `uri` is merged with the explicit options by mysql2, and explicit options win,
 * so a forced `ssl` block is never downgraded by the connection string.
 */
export function buildConnectionConfig(): ConnectionOptions {
  const ssl = buildSslConfig();
  const base: ConnectionOptions = {
    charset: 'utf8mb4',
    timezone: 'local',
    ...(ssl ? { ssl } : {}),
  };

  if (env.DATABASE_URL) {
    return { ...base, uri: env.DATABASE_URL };
  }

  return {
    ...base,
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  };
}
