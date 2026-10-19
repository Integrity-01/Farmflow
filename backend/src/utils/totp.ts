import crypto from 'node:crypto';

/**
 * Minimal RFC 6238 (TOTP) / RFC 4226 (HOTP) implementation built on Node's
 * crypto. No third-party dependency: system-administrator MFA must work on a
 * plain Node runtime and the algorithm is small and well specified.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DIGITS = 6;
const TIME_STEP_SECONDS = 30;
/** Accept the previous/next window so small clock drift does not lock an admin out. */
const DEFAULT_WINDOW = 1;

/** Encode raw bytes as RFC 4648 base32 (no padding). */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** Decode an RFC 4648 base32 string (case-insensitive, ignores spaces/padding). */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Generate a new base32 TOTP secret (default 160 bits, per RFC 4226). */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

/** Hotp value for a specific counter using HMAC-SHA1 and dynamic truncation. */
export function hotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  // Counter may exceed 32 bits; write as a 64-bit big-endian integer.
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac('sha1', secret).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = binary % 10 ** DIGITS;
  return code.toString().padStart(DIGITS, '0');
}

/** Derive the TOTP code for a base32 secret at a given unix time (ms or sec). */
export function generateTotp(secretBase32: string, atMs: number = Date.now()): string {
  const counter = Math.floor(atMs / 1000 / TIME_STEP_SECONDS);
  return hotp(base32Decode(secretBase32), counter);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify a submitted TOTP token against the secret, allowing +/- `window`
 * time-steps of clock drift. Comparison is constant-time.
 */
export function verifyTotp(
  secretBase32: string,
  token: string,
  options: { window?: number; atMs?: number } = {},
): boolean {
  const normalized = token.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;

  const secret = base32Decode(secretBase32);
  if (secret.length === 0) return false;

  const window = options.window ?? DEFAULT_WINDOW;
  const baseCounter = Math.floor((options.atMs ?? Date.now()) / 1000 / TIME_STEP_SECONDS);

  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = hotp(secret, baseCounter + offset);
    if (safeEqual(candidate, normalized)) return true;
  }
  return false;
}

/** Build an otpauth:// URI for authenticator apps (QR enrollment). */
export function buildOtpauthUri(issuer: string, accountName: string, secretBase32: string): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(TIME_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
