/* Live regression test for recurring tasks (Phase 12). */
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const BASE = 'http://localhost:4000/api';
let pass = 0;
let fail = 0;

function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

async function request(reqPath, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${reqPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function main() {
  const { Client } = require('./db-shim.cjs');
  const { recurringService } = await import(
    pathToFileURL(path.join(path.resolve(__dirname, 'dist'), 'services/recurring.service.js')).href
  );

  const db = new Client({ connectionString: process.env.DATABASE_URL || 'mysql://root:@localhost:3306/farmflow' });
  await db.connect();

  // Remove residue from any earlier interrupted run so "first user -> admin" holds.
  await db.query('DELETE FROM farms WHERE name = $1', ['Recurring Test Farm']);
  await db.query("DELETE FROM users WHERE email LIKE 'tmp-recurring-%'");
  await db.end();

  const email = `tmp-recurring-${Date.now()}@example.com`;
  const reg = await request('/auth/register', {
    method: 'POST',
    body: { name: 'Recurring Admin', email, password: 'test12345' },
  });
  check('register user', reg.status === 201, JSON.stringify(reg.json));
  const token = reg.json.accessToken;
  const promote = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await promote.connect();
  await promote.query('UPDATE users SET role = $1 WHERE id = $2', ['administrator', reg.json.user.id]);
  await promote.end();
  const meCheck = await request('/auth/me', { token });
  check('user promoted to admin', meCheck.status === 200 && meCheck.json.user.role === 'administrator', JSON.stringify(meCheck.json));

  const forRoutes = ['/recurring-tasks', '/recurring-tasks/foo', '/recurring-tasks/foo/generate'];
  for (const p of forRoutes) {
    const r = await request(p);
    check(`401 without token ${p}`, r.status === 401, String(r.status));
  }

  const createFarm = await request('/farms', {
    method: 'POST', token,
    body: { name: 'Recurring Test Farm', size: '5', sizeUnit: 'hectares' },
  });
  check('create farm', createFarm.status === 201, JSON.stringify(createFarm.json));
  const farmId = createFarm.json.farm.id;

  const cat = await request('/categories', { token });
  const categoryId = cat.json.data && cat.json.data.length ? cat.json.data[0].id : null;
  check('GET /categories', Array.isArray(cat.json.data) && cat.json.data.length > 0);

  const startDate = todayISO();

  const weekly = await request('/recurring-tasks', {
    method: 'POST', token,
    body: {
      title: 'Irrigate rows', description: 'Water Monday and Wednesday.',
      farmId, categoryId, priority: 'high', frequency: 'weekly',
      intervalCount: 1, weekdays: [1, 3], startTimeMinutes: 7 * 60,
      estimatedDurationMinutes: 45, reminderOffsetMinutes: 60,
      startDate, active: true,
    },
  });
  check('create weekly recurring rule', weekly.status === 201
    && weekly.json.data.frequency === 'weekly'
    && weekly.json.data.active === true
    && weekly.json.data.nextRunAt !== null, JSON.stringify(weekly.json));

  const ruleId = weekly.status === 201 ? weekly.json.data.id : null;

  if (ruleId) {
    const list = await request('/recurring-tasks', { token });
    check('GET /recurring-tasks lists rule', list.status === 200
      && list.json.data.some((r) => r.id === ruleId), JSON.stringify(list.json));

    const get = await request(`/recurring-tasks/${ruleId}`, { token });
    check('GET /recurring-tasks/:id', get.status === 200
      && get.json.data.id === ruleId && get.json.data.weekdays.length === 2);

    const skip = await request(`/recurring-tasks/${ruleId}/skip-next`, { method: 'POST', token });
    check('skip-next marks skip', skip.status === 200 && skip.json.data.skipNext === true);

    const genSkipped = await request(`/recurring-tasks/${ruleId}/generate`, { method: 'POST', token });
    check('generate honors skip (no task)', genSkipped.status === 200
      && genSkipped.json.data.skipped === true && genSkipped.json.data.task === null);

    const gen = await request(`/recurring-tasks/${ruleId}/generate`, { method: 'POST', token });
    check('generate creates instance', gen.status === 200
      && gen.json.data.skipped === false && gen.json.data.task && gen.json.data.task.id, JSON.stringify(gen.json));

    const taskId = gen.json.data.task ? gen.json.data.task.id : null;
    if (taskId) {
      const t = await request(`/tasks/${taskId}`, { token });
      check('generated task fetchable', t.status === 200
        && t.json.data.title === 'Irrigate rows'
        && t.json.data.priority === 'high'
        && t.json.data.farmId === farmId,
        `status=${t.status} data=${JSON.stringify(t.json && t.json.data)}`);
    }

    const pause = await request(`/recurring-tasks/${ruleId}/pause`, { method: 'POST', token });
    check('pause sets inactive', pause.status === 200 && pause.json.data.active === false);

    const genPaused = await request(`/recurring-tasks/${ruleId}/generate`, { method: 'POST', token });
    check('generate while paused -> 409', genPaused.status === 409 && genPaused.json.code === 'RULE_INACTIVE');

    const activate = await request(`/recurring-tasks/${ruleId}/activate`, { method: 'POST', token });
    check('activate sets active', activate.status === 200 && activate.json.data.active === true);

    const patch = await request(`/recurring-tasks/${ruleId}`, {
      method: 'PATCH', token,
      body: { frequency: 'daily', intervalCount: 2, description: 'Water every two days.' },
    });
    check('patch updates schedule', patch.status === 200
      && patch.json.data.frequency === 'daily'
      && patch.json.data.intervalCount === 2
      && patch.json.data.nextRunAt !== null, JSON.stringify(patch.json));

    const del = await request(`/recurring-tasks/${ruleId}`, { method: 'DELETE', token });
    check('delete rule -> 204', del.status === 204);

    if (taskId) {
      const { Client } = require('./db-shim.cjs');
      const db = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
      await db.connect();
      await db.query('DELETE FROM tasks WHERE id = $1', [taskId]);
      await db.end();
    }
  }

  // Auto-generation via processDue (the scheduler path), exercising the real
  // compiled dist service against the live database.
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/farmflow';
  const db2 = new Client({ connectionString: process.env.DATABASE_URL });
  await db2.connect();

  const stamp = Date.now();
  const crypto = require('node:crypto');
  const dueRuleId = crypto.randomUUID();
  const dueRule = await db2.query(
    `INSERT INTO recurring_tasks (
       id, title, farm_id, category_id, created_by, priority, frequency,
       interval_count, start_time_minutes, start_date, active, next_run_at
     ) VALUES (
       $1, $2, $3, $4, $5, 'medium', 'daily', 1, 420, $6, true,
       now() - INTERVAL 1 MINUTE
     )`,
    [dueRuleId, `Auto-due rule ${stamp}`, farmId, categoryId, reg.json.user.id, startDate],
  );
  check('inserted auto-due rule', dueRule.rowCount === 1);

  const generatedNow = await recurringService.processDue();
  check('processDue generated the due rule', generatedNow >= 1, String(generatedNow));

  const dueTask = await db2.query(
    'SELECT id FROM tasks WHERE title = $1 AND farm_id = $2 ORDER BY created_at DESC LIMIT 1',
    [`Auto-due rule ${stamp}`, farmId],
  );
  check('processDue created a task instance', dueTask.rows.length === 1);

  const ruleAfter = await db2.query('SELECT generated_count, next_run_at FROM recurring_tasks WHERE id = $1', [dueRuleId]);
  check('processDue advanced rule', ruleAfter.rows.length === 1
    && ruleAfter.rows[0].generated_count >= 1
    && ruleAfter.rows[0].next_run_at !== null, JSON.stringify(ruleAfter.rows[0]));

  if (dueTask.rows.length === 1) await db2.query('DELETE FROM tasks WHERE id = $1', [dueTask.rows[0].id]);
  await db2.query('DELETE FROM recurring_tasks WHERE id = $1', [dueRuleId]);
  await db2.query('DELETE FROM farms WHERE id = $1', [farmId]);
  await db2.query('DELETE FROM users WHERE email = $1', [email]);
  await db2.end();
  console.log('  cleanup done');

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });