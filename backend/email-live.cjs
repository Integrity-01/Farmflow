const BASE = 'http://localhost:4000/api';
async function call(path, { token, body, method = 'GET' } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}
(async () => {
  const { Client } = require('./db-shim.cjs');
  const db = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await db.connect();
  await db.query("DELETE FROM farms WHERE name = 'Email Test Farm'");
  await db.query("DELETE FROM workers WHERE name LIKE 'tmp-email-%'");
  await db.query("DELETE FROM users WHERE email LIKE 'tmp-email-%'");
  await db.end();

  const stamp = Date.now();
  const admin = await call('/auth/register', { method: 'POST', body: { name: 'Email Admin', email: `tmp-email-admin-${stamp}@example.com`, password: 'Passw0rd!123' } });
  const adminToken = admin.data.accessToken;
  const dbPromote = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await dbPromote.connect();
  await dbPromote.query('UPDATE users SET role = $1 WHERE id = $2', ['administrator', admin.data.user.id]);
  await dbPromote.end();
  const farm = await call('/farms', { method: 'POST', token: adminToken, body: { name: 'Email Test Farm', location: '', status: 'active', managerId: admin.data.user.id } });
  const me = await call('/auth/me', { token: adminToken });
  console.log('admin me role:', me.data.user.role, 'farm create:', farm.status, JSON.stringify(farm.data).slice(0, 160));
  const farmId = farm.data.farm.id;
  const cats = await call('/categories', { token: adminToken });
  const catId = cats.data.data[0].id;

  const workerUser = await call('/auth/register', { method: 'POST', body: { name: 'Email Worker', email: `tmp-email-worker-${stamp}@example.com`, password: 'Passw0rd!123' } });
  const worker = await call('/workers', { method: 'POST', token: adminToken, body: { name: `tmp-email-w-${stamp}`, farmId, status: 'active' } });
  const db2 = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await db2.connect();
  await db2.query('UPDATE workers SET user_id = $1 WHERE id = $2', [workerUser.data.user.id, worker.data.data.id]);
  await db2.end();

  const task = await call('/tasks', {
    method: 'POST',
    token: adminToken,
    body: {
      title: `Email trigger task ${stamp}`,
      farmId,
      categoryId: catId,
      assignedTo: worker.data.data.id,
      priority: 'medium',
      deadlineAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    },
  });
  const taskId = task.data.data.id;

  const comments = await call(`/tasks/${taskId}/comments`, { method: 'POST', token: adminToken, body: { body: 'Please verify the drip lines.' } });

  const workerNotifs = await call('/notifications', { token: workerUser.data.accessToken });
  const types = workerNotifs.data.data.items.map((n) => n.type);
  console.log('task created:', task.status === 201 ? 'PASS' : `FAIL (${task.status})`);
  console.log('comment posted:', comments.status === 201 ? 'PASS' : `FAIL (${comments.status})`);
  console.log('assignee got task_assigned notification:', types.includes('task_assigned') ? 'PASS' : `FAIL (${types.join(',') || 'none'})`);

  const mod = await import('file:///C:/xampp/htdocs/farmflow/backend/dist/services/email.service.js');
  const emailService = mod.emailService ?? (mod.default || {}).emailService;
  const { pool } = await import('file:///C:/xampp/htdocs/farmflow/backend/dist/database/pool.js');
  const ctx = {
    total: 2,
    completed: 1,
    dueToday: 1,
    overdue: 1,
    items: [{ title: 'Check bin <b>integrity</b>', dueLabel: 'today', status: 'todo' }],
  };
  try {
    await emailService.sendDailySummary(workerUser.data.user.id, ctx);
    console.log('daily summary email pipeline: PASS (no throw)');
  } catch (e) {
    console.log('daily summary email pipeline: FAIL', e.message);
  }

  const db3 = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await db3.connect();
  const safe = async (sql, args) => { try { await db3.query(sql, args); } catch (e) { console.log('cleanup skip:', e.message.slice(0, 60)); } };
  await safe('DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['tmp-email-%']);
  await safe('DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE farm_id = $1)', [farmId]);
  await safe('DELETE FROM farms WHERE id = $1', [farmId]);
  await safe('DELETE FROM workers WHERE name LIKE $1', [`tmp-email-w-${stamp}`]);
  await safe('DELETE FROM users WHERE email LIKE $1', ['tmp-email-%']);
  await db3.end();
  console.log('cleanup done');
  // The imported dist service opens a mysql2 pool; close it so the process
  // can exit cleanly instead of lingering on an idle socket.
  await pool.end();
  process.exit(0);
})().catch((e) => {
  console.error('ERROR', e);
  process.exit(1);
});