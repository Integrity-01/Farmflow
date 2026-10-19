import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYSTEM_ADMIN_ID_PREFIX,
  generateSystemAdminId,
  isSystemAdminIdFormat,
  normalizeSystemAdminId,
} from '../src/utils/system-admin-id.js';
import {
  base32Decode,
  base32Encode,
  buildOtpauthUri,
  generateTotp,
  generateTotpSecret,
  hotp,
  verifyTotp,
} from '../src/utils/totp.js';
import { generateTemporaryPassword } from '../src/utils/password.js';

const SAMPLE = 'FF-SYS-8K29-XP6R';

test('generateSystemAdminId returns a canonical FF-SYS-XXXX-XXXX identifier', () => {
  for (let i = 0; i < 250; i += 1) {
    assert.ok(isSystemAdminIdFormat(generateSystemAdminId()));
  }
});

test('generateSystemAdminId never collides with an Admin ID prefix', () => {
  const id = generateSystemAdminId();
  assert.ok(id.startsWith(`${SYSTEM_ADMIN_ID_PREFIX}-`));
  assert.ok(!id.startsWith('FF-ADM-'));
});

test('generateSystemAdminId produces effectively unique identifiers', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i += 1) seen.add(generateSystemAdminId());
  assert.ok(seen.size > 990, `too many collisions: ${1000 - seen.size}`);
});

test('normalizeSystemAdminId canonicalises spacing, case and missing dashes', () => {
  assert.equal(normalizeSystemAdminId(`  ${SAMPLE.toLowerCase()} `), SAMPLE);
  assert.equal(normalizeSystemAdminId('ff sys 8k29 xp6r'), SAMPLE);
  assert.equal(normalizeSystemAdminId('FFSYS8K29XP6R'), SAMPLE);
  assert.equal(normalizeSystemAdminId(SAMPLE), SAMPLE);
});

test('isSystemAdminIdFormat accepts only canonical identifiers', () => {
  assert.equal(isSystemAdminIdFormat(SAMPLE), true);
  assert.equal(isSystemAdminIdFormat(SAMPLE.toLowerCase()), false);
  assert.equal(isSystemAdminIdFormat('FF-SYS-8K2I-XP6R'), false);
  assert.equal(isSystemAdminIdFormat('FF-SYS-8K29-XP6'), false);
  assert.equal(isSystemAdminIdFormat('FF-ADM-8K29-XP6R'), false);
});

test('base32 round-trips arbitrary bytes', () => {
  const buffer = Buffer.from('FarmFlow system administrator MFA secret!', 'utf8');
  assert.deepEqual(base32Decode(base32Encode(buffer)), buffer);
});

test('base32Decode ignores spaces, padding and case', () => {
  const encoded = base32Encode(Buffer.from('hello world'));
  const messy = `  ${encoded.toLowerCase()}  `;
  assert.deepEqual(base32Decode(messy), Buffer.from('hello world'));
});

// RFC 4226 Appendix D — the canonical HOTP 6-digit test vectors. The base32
// value is the encoding of the ASCII test secret "12345678901234567890".
const HOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const HOTP_VECTORS: Array<[number, string]> = [
  [0, '755224'],
  [1, '287082'],
  [2, '359152'],
  [3, '969429'],
  [4, '338314'],
  [5, '254676'],
  [6, '287922'],
  [7, '162583'],
  [8, '399871'],
  [9, '520489'],
];

test('hotp matches the RFC 4226 test vectors', () => {
  const secret = base32Decode(HOTP_SECRET);
  for (const [counter, expected] of HOTP_VECTORS) {
    assert.equal(hotp(secret, counter), expected, `counter ${counter}`);
  }
});

test('generateTotp derives the code for the correct 30s time step', () => {
  assert.equal(generateTotp(HOTP_SECRET, 0), '755224');
  assert.equal(generateTotp(HOTP_SECRET, 30 * 1000), '287082');
  assert.equal(generateTotp(HOTP_SECRET, 30 * 2 * 1000), '359152');
});

test('verifyTotp accepts the current code and rejects a stale one', () => {
  const at = 30 * 4 * 1000;
  const current = generateTotp(HOTP_SECRET, at);
  assert.equal(verifyTotp(HOTP_SECRET, current, { atMs: at }), true);
  // Counter 0 is far outside the +/-1 window around counter 4.
  assert.equal(verifyTotp(HOTP_SECRET, '755224', { atMs: at }), false);
});

test('verifyTotp tolerates one step of clock drift in either direction', () => {
  const at = 30 * 10 * 1000;
  const previous = generateTotp(HOTP_SECRET, at - 30 * 1000);
  const next = generateTotp(HOTP_SECRET, at + 30 * 1000);
  assert.equal(verifyTotp(HOTP_SECRET, previous, { atMs: at, window: 1 }), true);
  assert.equal(verifyTotp(HOTP_SECRET, next, { atMs: at, window: 1 }), true);
});

test('verifyTotp rejects malformed codes', () => {
  assert.equal(verifyTotp(HOTP_SECRET, '12345'), false);
  assert.equal(verifyTotp(HOTP_SECRET, 'abcdef'), false);
  assert.equal(verifyTotp(HOTP_SECRET, ''), false);
});

test('generateTotpSecret is decodable base32 and reasonably long', () => {
  const secret = generateTotpSecret();
  assert.ok(secret.length >= 26);
  assert.ok(base32Decode(secret).length >= 16);
});

test('buildOtpauthUri produces a valid totp enrollment URI', () => {
  const uri = buildOtpauthUri('FarmFlow System', 'owner@farmflow.test', HOTP_SECRET);
  assert.ok(uri.startsWith('otpauth://totp/'));
  assert.ok(uri.includes(`secret=${HOTP_SECRET}`));
  assert.ok(uri.includes('issuer=FarmFlow+System'));
  assert.ok(uri.includes('period=30'));
});

test('generateTemporaryPassword satisfies the password policy classes', () => {
  for (let i = 0; i < 100; i += 1) {
    const password = generateTemporaryPassword();
    assert.ok(password.length >= 12);
    assert.ok(/[A-Z]/.test(password));
    assert.ok(/[a-z]/.test(password));
    assert.ok(/[0-9]/.test(password));
    assert.ok(/[!@#$%&*]/.test(password));
  }
});
