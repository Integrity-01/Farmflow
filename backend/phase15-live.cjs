/* Live regression test for AI assistant (Phase 15). */
const BASE = 'http://localhost:4000/api';
let pass = 0;
let fail = 0;

function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function main() {
  const email = `tmp-ai-${Date.now()}@example.com`;

  const reg = await request('/auth/register', {
    method: 'POST',
    body: { name: 'Temp Admin', email, password: 'test12345' },
  });
  check('register creates account', reg.status === 201 && !!reg.json.user.id, JSON.stringify(reg.json));
  const token = reg.json.accessToken;

  const { Client } = require('./db-shim.cjs');
  const promote = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await promote.connect();
  await promote.query('UPDATE users SET role = $1 WHERE id = $2', ['administrator', reg.json.user.id]);
  await promote.end();

  const unauth = await fetch(`${BASE}/ai/status`).catch(() => null);
  check('/ai/status 401 without token', unauth && unauth.status === 401, String(unauth?.status));

  const status = await request('/ai/status', { token });
  check('/ai/status -> 200 configured:false (no key installed)',
    status.status === 200 && status.json.configured === false, JSON.stringify(status.json));

  const chat = await request('/ai/chat', {
    method: 'POST', token,
    body: { message: 'What should I do today?' },
  });
  check('chat without key -> 501 AI_NOT_CONFIGURED',
    chat.status === 501 && chat.json.code === 'AI_NOT_CONFIGURED', JSON.stringify(chat.json));

  const suggest = await request('/ai/suggest', { method: 'POST', token, body: {} });
  check('suggest without key -> 501 AI_NOT_CONFIGURED',
    suggest.status === 501 && suggest.json.code === 'AI_NOT_CONFIGURED', JSON.stringify(suggest.json));

  const empty = await request('/ai/chat', { method: 'POST', token, body: { message: '   ' } });
  check('chat with empty message -> 400 VALIDATION_ERROR',
    empty.status === 400 && empty.json.code === 'VALIDATION_ERROR', JSON.stringify(empty.json));

  const badFarm = await request('/ai/suggest', { method: 'POST', token, body: { farmId: 'not-a-uuid' } });
  check('suggest with bad farmId -> 400',
    badFarm.status === 400 && badFarm.json.code === 'VALIDATION_ERROR', JSON.stringify(badFarm.json));

  const workerEmail = `tmp-ai-w-${Date.now()}@example.com`;
  const workerReg = await request('/auth/register', {
    method: 'POST',
    body: { name: 'Temp Worker', email: workerEmail, password: 'test12345' },
  });
  check('register worker', workerReg.status === 201, JSON.stringify(workerReg.json));
  const workerToken = workerReg.json.accessToken;

  const forbidden = await request('/ai/status', { token: workerToken });
  check('field_worker blocked from /ai -> 403',
    forbidden.status === 403 && forbidden.json.code === 'FORBIDDEN', JSON.stringify(forbidden.json));

  const db = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await db.connect();
  await db.query('DELETE FROM users WHERE email IN ($1, $2)', [email, workerEmail]);
  await db.end();
  console.log('  cleanup done');

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});