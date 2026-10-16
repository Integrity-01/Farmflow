import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_ID_ALPHABET,
  generateAdminId,
  isAdminIdFormat,
  normalizeAdminId,
} from '../src/utils/admin-id.js';

const SAMPLE = 'FF-ADM-8K29-XP6R';

test('generateAdminId returns a canonical FF-ADM-XXXX-XXXX identifier', () => {
  for (let i = 0; i < 250; i += 1) {
    const id = generateAdminId();
    assert.ok(isAdminIdFormat(id), `not a valid format: ${id}`);
  }
});

test('generateAdminId only uses the unambiguous alphabet (no I, O, 0, 1)', () => {
  const id = generateAdminId();
  const body = id.replace(/^FF-ADM-/, '').replace('-', '');
  for (const char of body) {
    assert.ok(ADMIN_ID_ALPHABET.includes(char), `unexpected character: ${char}`);
  }
  assert.ok(!/[IO01]/.test(body), `ambiguous character found in: ${id}`);
});

test('generateAdminId produces effectively unique identifiers', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i += 1) {
    seen.add(generateAdminId());
  }
  assert.ok(seen.size > 990, `too many collisions: ${1000 - seen.size}`);
});

test('normalizeAdminId canonicalises spacing, case and missing dashes', () => {
  assert.equal(normalizeAdminId(`  ${SAMPLE.toLowerCase()} `), SAMPLE);
  assert.equal(normalizeAdminId('ff adm 8k29 xp6r'), SAMPLE);
  assert.equal(normalizeAdminId('FFADM8K29XP6R'), SAMPLE);
  assert.equal(normalizeAdminId(SAMPLE), SAMPLE);
});

test('isAdminIdFormat accepts only canonical identifiers', () => {
  assert.equal(isAdminIdFormat(SAMPLE), true);
  assert.equal(isAdminIdFormat(SAMPLE.toLowerCase()), false);
  assert.equal(isAdminIdFormat('FF-ADM-8K2I-XP6R'), false); // contains I
  assert.equal(isAdminIdFormat('FF-ADM-8K20-XP6R'), false); // contains 0
  assert.equal(isAdminIdFormat('ADM-8K29-XP6R'), false);
  assert.equal(isAdminIdFormat('FF-ADM-8K2-XP6R'), false);
  assert.equal(isAdminIdFormat('FF-ADM-8K29-XP6'), false);
});
