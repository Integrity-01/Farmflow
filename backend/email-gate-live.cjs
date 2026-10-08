/* Live test for email type-branch rendering + per-type preference gating (Phase 12 email). */
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const BASE = 'http://localhost:4000/api';
let pass = 0;
let fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}
async function call(p, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const emailLines = [];
const origWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (d, ...a) => {
  const s = String(d);
  if (s.includes('Email not sent')) emailLines.push(s);
  return origWrite(d, ...a);
};

(async () => {
  const { Client } = require('./db-shim.cjs');
  const db = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await db.connect();
  await db.query("DELETE FROM farms WHERE name = 'Email Gate Farm'");
  await db.query("DELETE FROM workers WHERE name LIKE 'tmp-gate-%'");
  await db.query("DELETE FROM users WHERE email LIKE 'tmp-gate-%'");
  await db.end();

  const stamp = Date.now();
  const admin = await call('/auth/register', { method: 'POST', body: { name: 'Gate Admin', email: `tmp-gate-a-${stamp}@example.com`, password: 'Passw0rd!123' } });
  const pro = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await pro.connect();
  await pro.query('UPDATE users SET role = $1 WHERE id = $2', ['administrator', admin.data.user.id]);
  await pro.end();
  const adminToken = admin.data.accessToken;

  const workerUser = await call('/auth/register', { method: 'POST', body: { name: 'Gate Worker', email: `tmp-gate-w-${stamp}@example.com`, password: 'Passw0rd!123' } });
  const workerToken = workerUser.data.accessToken;
  const workerId = workerUser.data.user.id;

  const farm = await call('/farms', { method: 'POST', token: adminToken, body: { name: 'Email Gate Farm', location: '', status: 'active', managerId: admin.data.user.id } });
  const farmId = farm.data.farm.id;
  const cats = await call('/categories', { token: adminToken });
  const catId = cats.data.data[0].id;
  const worker = await call('/workers', { method: 'POST', token: adminToken, body: { name: `tmp-gate-w-${stamp}`, farmId, status: 'active' } });
  const link = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await link.connect();
  await link.query('UPDATE workers SET user_id = $1 WHERE id = $2', [workerId, worker.data.data.id]);
  await link.end();

  const task = await call('/tasks', { method: 'POST', token: adminToken, body: { title: `Gate task ${stamp}`, farmId, categoryId: catId, assignedTo: worker.data.data.id, priority: 'medium', deadlineAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString() } });
  const taskId = task.data.data.id;

  // Run the render/gating checks in log mode so the test is independent of
  // whether live SMTP is configured. dotenv never overrides existing vars,
  // so blanking these before the service import forces the fallback branch.
  process.env.EMAIL_PROVIDER = 'smtp';
  process.env.EMAIL_HOST = '';
  process.env.EMAIL_USER = '';
  process.env.EMAIL_PASS = '';

  const { emailService } = await import(pathToFileURL(path.join(path.resolve(__dirname, 'dist'), 'services/email.service.js')).href);

  const before = emailLines.length;
  await emailService.sendToUser(workerId, { type: 'task_due_soon', taskId });
  check('due-soon email branch renders', emailLines.length === before + 1 && /Due soon: Gate task/.test(emailLines[before]), emailLines.slice(before).join(' | '));

  const b2 = emailLines.length;
  await emailService.sendToUser(workerId, { type: 'task_overdue', taskId });
  check('overdue email branch renders', emailLines.length === b2 + 1 && /Overdue: Gate task/.test(emailLines[b2]), emailLines.slice(b2).join(' | '));

  const b3 = emailLines.length;
  await emailService.sendToUser(workerId, { type: 'task_completed', taskId });
  check('completed email branch renders', emailLines.length === b3 + 1 && /Task completed: Gate task/.test(emailLines[b3]), emailLines.slice(b3).join(' | '));

  const gate = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await gate.connect();
  await gate.query('UPDATE notification_preferences SET email_enabled = false WHERE user_id = $1', [workerId]);
  await gate.end();
  const b4 = emailLines.length;
  await emailService.sendToUser(workerId, { type: 'task_due_soon', taskId });
  check('master email_enabled=false blocks send', emailLines.length === b4, emailLines.slice(b4).join(' | '));

  const gate2 = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await gate2.connect();
  await gate2.query('UPDATE notification_preferences SET email_enabled = true, task_completions = false WHERE user_id = $1', [workerId]);
  await gate2.end();
  const b5 = emailLines.length;
  await emailService.sendToUser(workerId, { type: 'task_completed', taskId });
  check('per-type task_completions=false blocks send', emailLines.length === b5, emailLines.slice(b5).join(' | '));

  const gate3 = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await gate3.connect();
  await gate3.query('UPDATE notification_preferences SET task_completions = true WHERE user_id = $1', [workerId]);
  await gate3.end();
  const b6 = emailLines.length;
  await emailService.sendToUser(workerId, { type: 'task_completed', taskId });
  check('re-enabled per-type pref sends again', emailLines.length === b6 + 1, emailLines.slice(b6).join(' | '));

  const clean = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await clean.connect();
  const safe = async (sql, a) => { try { await clean.query(sql, a); } catch (e) { console.log('cleanup skip:', e.message.slice(0, 60)); } };
  await safe('DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['tmp-gate-%']);
  await safe('DELETE FROM farms WHERE id = $1', [farmId]);
  await safe('DELETE FROM workers WHERE name LIKE $1', ['tmp-gate-%']);
  await safe('DELETE FROM users WHERE email LIKE $1', ['tmp-gate-%']);
  await clean.end();
  console.log('cleanup done');

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(1);
});
