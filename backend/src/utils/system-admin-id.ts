import crypto from 'node:crypto';
import { ADMIN_ID_ALPHABET } from './admin-id.js';

/**
 * System Administrator login identifiers use a distinct, visually unambiguous
 * prefix (`FF-SYS-XXXX-XXXX`) so a platform administrator identity can never be
 * mistaken for an organization Admin ID (`FF-ADM-...`). They are generated from
 * a cryptographically secure source and are not derived from personal data.
 */
export const SYSTEM_ADMIN_ID_PREFIX = 'FF-SYS';
const CHUNK_LENGTH = 4;
const CHUNK_COUNT = 2;
// Prefix without dashes (FFSYS = 5 chars) + two 4-char chunks.
const COMPACT_LENGTH = SYSTEM_ADMIN_ID_PREFIX.replace(/-/g, '').length + CHUNK_LENGTH * CHUNK_COUNT;

function randomChunk(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ADMIN_ID_ALPHABET[bytes[i] % ADMIN_ID_ALPHABET.length];
  }
  return out;
}

/** Generate a fresh System Administrator ID. Uniqueness is enforced by the DB. */
export function generateSystemAdminId(): string {
  const chunks: string[] = [];
  for (let i = 0; i < CHUNK_COUNT; i += 1) {
    chunks.push(randomChunk(CHUNK_LENGTH));
  }
  return `${SYSTEM_ADMIN_ID_PREFIX}-${chunks.join('-')}`;
}

/**
 * Normalize operator input so an administrator can type or paste their System
 * Administrator ID with arbitrary spacing/case and optional dashes. Unknown
 * input (not matching the expected shape) is returned upper-cased and stripped
 * so a lookup simply misses rather than throwing.
 */
export function normalizeSystemAdminId(input: string): string {
  const compact = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefixCompact = SYSTEM_ADMIN_ID_PREFIX.replace(/-/g, '');
  if (compact.startsWith(prefixCompact) && compact.length === COMPACT_LENGTH) {
    const body = compact.slice(prefixCompact.length);
    return `${SYSTEM_ADMIN_ID_PREFIX}-${body.slice(0, CHUNK_LENGTH)}-${body.slice(CHUNK_LENGTH)}`;
  }
  return compact;
}

/** Validate the canonical shape of a System Administrator ID (post-normalize). */
export function isSystemAdminIdFormat(value: string): boolean {
  const body = `[${ADMIN_ID_ALPHABET}]{${CHUNK_LENGTH}}`;
  return new RegExp(`^${SYSTEM_ADMIN_ID_PREFIX}-${body}-${body}$`).test(value);
}

/**
 * Format a System Administrator ID for display or live input. The operator only
 * ever needs to provide the thirteen-character value (e.g. `FFSYSLTPRZJ8V`);
 * the separating hyphens are added by the system. Partial input is supported so
 * this can run on every keystroke.
 */
export function formatSystemAdminId(input: string): string {
  const compact = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefixCompact = SYSTEM_ADMIN_ID_PREFIX.replace(/-/g, '');
  if (!compact.startsWith(prefixCompact)) {
    return compact;
  }
  const body = compact.slice(prefixCompact.length).slice(0, CHUNK_LENGTH * CHUNK_COUNT);
  if (body.length <= CHUNK_LENGTH) {
    return `${SYSTEM_ADMIN_ID_PREFIX}-${body}`;
  }
  return `${SYSTEM_ADMIN_ID_PREFIX}-${body.slice(0, CHUNK_LENGTH)}-${body.slice(CHUNK_LENGTH)}`;
}
