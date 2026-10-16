import crypto from 'node:crypto';

/**
 * Admin IDs are human-readable login identifiers of the form
 * `FF-ADM-XXXX-XXXX`. They are generated with a cryptographically secure
 * random source and are NOT derived from any personal information.
 *
 * The alphabet deliberately omits visually ambiguous characters (I, O, 0, 1)
 * so an administrator can read and type their Admin ID reliably. It has 32
 * symbols, which divides 256 evenly, so mapping random bytes to symbols by
 * modulo introduces no bias.
 */
export const ADMIN_ID_PREFIX = 'FF-ADM';
export const ADMIN_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CHUNK_LENGTH = 4;
const CHUNK_COUNT = 2;

function randomChunk(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ADMIN_ID_ALPHABET[bytes[i] % ADMIN_ID_ALPHABET.length];
  }
  return out;
}

/** Generate a fresh, unverified Admin ID. Uniqueness is enforced by the DB. */
export function generateAdminId(): string {
  const chunks: string[] = [];
  for (let i = 0; i < CHUNK_COUNT; i += 1) {
    chunks.push(randomChunk(CHUNK_LENGTH));
  }
  return `${ADMIN_ID_PREFIX}-${chunks.join('-')}`;
}

/**
 * Normalize user input for lookups so an administrator can type or paste their
 * Admin ID with arbitrary spacing and optional dashes, e.g. `ff adm 8k29 xp61`
 * or `FFADM8K29XP61` both resolve to `FF-ADM-8K29-XP61`. Uppercases, strips all
 * non-alphanumeric characters, then re-applies the canonical dash layout when
 * the compact form matches the expected shape.
 */
export function normalizeAdminId(input: string): string {
  const compact = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.startsWith('FFADM') && compact.length === 13) {
    return `${ADMIN_ID_PREFIX}-${compact.slice(5, 9)}-${compact.slice(9, 13)}`;
  }
  return compact;
}

/** Validate the canonical shape of an Admin ID (after normalization). */
export function isAdminIdFormat(value: string): boolean {
  const body = `[${ADMIN_ID_ALPHABET}]{${CHUNK_LENGTH}}`;
  return new RegExp(`^${ADMIN_ID_PREFIX}-${body}-${body}$`).test(value);
}
