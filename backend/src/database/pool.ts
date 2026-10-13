import { randomUUID } from 'node:crypto';
import { createPool } from 'mysql2/promise';
import { env } from '../config/env.js';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  insertId?: number;
}

const BOOLEAN_COLUMNS = new Set([
  'is_active',
  'is_system',
  'is_read',
  'active',
  'skip_next',
  'email_enabled',
  'push_enabled',
  'in_app_enabled',
  'task_assignments',
  'deadline_reminders',
  'overdue_alerts',
  'task_completions',
  'daily_summary',
]);

const JSON_COLUMNS = new Set(['old_value', 'new_value', 'metadata', 'filters', 'skills', 'weekdays']);

/**
 * Translates the small Postgres dialect surface used across the services into
 * MySQL/MariaDB syntax. `$n` placeholders become `?`, type casts, ILIKE and
 * boolean literals are normalised, and "ON CONFLICT ... DO NOTHING" clauses
 * are dropped (call sites that need them use INSERT IGNORE / ON DUPLICATE KEY
 * explicitly).
 */
function translate(sql: string): string {
  return sql
    .replace(/\s+ON\s+CONFLICT\s*\([^)]*\)\s*DO\s+NOTHING/gi, '')
    .replace(/\s+ON\s+CONFLICT\s+DO\s+NOTHING/gi, '')
    .replace(/\s*::(text|int|integer|date|uuid|jsonb|timestamptz|float|numeric|smallint|double precision|boolean|varchar)\b/gi, '')
    .replace(/\bILIKE\b/gi, 'LIKE')
    .replace(/= TRUE\b/gi, '= 1')
    .replace(/= FALSE\b/gi, '= 0');
}

/**
 * Postgres `$n` placeholders are positional by NUMBER; MySQL `?` are
 * positional by TEXT ORDER. E.g. `SET x = $2 ... WHERE id = $1` binds the
 * SECOND array element to `x` in PG, but a naive `$n`→`?` translation would
 * bind the FIRST. Reorder the params array so each `?` (in reading order)
 * receives the value its `$n` referred to. Duplicate `$n` reuse the same value.
 */
function orderParams(sql: string, params: unknown[]): unknown[] {
  const refs = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
  if (refs.length === 0) return params;
  return refs.map((n) => params[n - 1]);
}

function coerceRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (BOOLEAN_COLUMNS.has(key)) {
      out[key] = value === 1 || value === true || value === '1' || value === 'true';
    } else if (JSON_COLUMNS.has(key) && typeof value === 'string') {
      try {
        out[key] = JSON.parse(value);
      } catch {
        out[key] = value;
      }
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

function buildConfig() {
  if (env.DATABASE_URL) {
    return { uri: env.DATABASE_URL };
  }
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  };
}

const mysql = createPool({
  ...buildConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'local',
  dateStrings: false,
  decimalNumbers: false,
});

type ExecResult = unknown[];

async function run<T = any>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const translated = translate(sql).replace(/\$\d+/g, '?');
  const ordered = orderParams(sql, params);
  const [raw] = (await mysql.query(translated, ordered)) as [ExecResult, unknown];
  if (Array.isArray(raw)) {
    const rows = (raw as Record<string, unknown>[]).map((row) => coerceRow<T>(row));
    return { rows, rowCount: rows.length };
  }
  const header = raw as { affectedRows?: number; insertId?: number };
  return { rows: [], rowCount: header.affectedRows ?? 0, insertId: header.insertId };
}

export const pool = {
  query: run,

  /**
   * Runs `work` inside a real MySQL transaction using a single dedicated
   * connection (mysql2 pooled `.query()` cannot span BEGIN/COMMIT).
   */
  async withTransaction<T>(work: (db: { query: typeof run }) => Promise<T>): Promise<T> {
    const connection = await mysql.getConnection();
    try {
      await connection.beginTransaction();
      const db = {
        query: async <R = any>(sql: string, params: unknown[] = []) => {
          const translated = translate(sql).replace(/\$\d+/g, '?');
          const ordered = orderParams(sql, params);
          const [raw] = (await connection.query(translated, ordered)) as [ExecResult, unknown];
          if (Array.isArray(raw)) {
            const rows = (raw as Record<string, unknown>[]).map((row) => coerceRow<R>(row));
            return { rows, rowCount: rows.length } as QueryResult<R>;
          }
          const header = raw as { affectedRows?: number; insertId?: number };
          return { rows: [], rowCount: header.affectedRows ?? 0, insertId: header.insertId } as QueryResult<R>;
        },
      };
      const result = await work(db);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async end() {
    await mysql.end();
  },
};

/** 36-char lower-case UUID for application-side PRIMARY KEYs. */
export function uid(): string {
  return randomUUID();
}

export async function pingDatabase(): Promise<{
  status: 'up' | 'down';
  latencyMs: number | null;
  message?: string;
}> {
  const started = Date.now();
  try {
    await mysql.query('SELECT 1');
    return { status: 'up', latencyMs: Date.now() - started };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    return { status: 'down', latencyMs: null, message };
  }
}