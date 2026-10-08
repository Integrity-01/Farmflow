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
  const email = `tmp-test-${Date.now()}@example.com`;

  const reg = await request('/auth/register', {
    method: 'POST',
    body: { name: 'Temp Admin', email, password: 'test12345' },
  });
  check('register creates account', reg.status === 201 && !!reg.json.user.id, JSON.stringify(reg.json));
  const token = reg.json.accessToken;

  // The app no longer auto-promotes the first user; elevate explicitly so the
  // admin-only surfaces (history, farm creation) are reachable.
  const { Client } = require('./db-shim.cjs');
  const promote = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await promote.connect();
  await promote.query('UPDATE users SET role = $1 WHERE id = $2', ['administrator', reg.json.user.id]);
  await promote.end();

  const unauth = await request('/api-invalid');
  void unauth;

  for (const path of ['/history', '/settings/profile', '/settings/notifications']) {
    const r = await fetch(`${BASE}${path}`).catch(() => null);
    check(`401 without token ${path}`, r && r.status === 401, String(r?.status));
  }

  const history0 = await request('/history', { token });
  check('GET /history (empty)', history0.status === 200 && Array.isArray(history0.json.data.items), JSON.stringify(history0.json));

  const profile = await request('/settings/profile', { token });
  check('GET /settings/profile', profile.status === 200 && profile.json.data.email === email);

  const updProfile = await request('/settings/profile', { method: 'PATCH', token, body: { name: 'Temp Admin Two', phone: '+234 8123' } });
  check('PATCH /settings/profile', updProfile.status === 200 && updProfile.json.data.name === 'Temp Admin Two');

  const prefs = await request('/settings/notifications', { token });
  check('GET /settings/notifications', prefs.status === 200 && prefs.json.data.dailySummary === false);

  const updPrefs = await request('/settings/notifications', { method: 'PATCH', token, body: { dailySummary: true, taskCompletions: false } });
  check('PATCH /settings/notifications', updPrefs.status === 200 && updPrefs.json.data.dailySummary === true && updPrefs.json.data.taskCompletions === false, JSON.stringify(updPrefs.status === 200 ? updPrefs.json.data : updPrefs.json));

  const wrongPw = await request('/settings/change-password', { method: 'POST', token, body: { currentPassword: 'nope', newPassword: 'newpassword99' } });
  check('change-password wrong current -> 400', wrongPw.status === 400 && wrongPw.json.code === 'INVALID_CURRENT_PASSWORD');

  const okPw = await request('/settings/change-password', { method: 'POST', token, body: { currentPassword: 'test12345', newPassword: 'newpassword99' } });
  check('change-password ok', okPw.status === 200);

  const login = await request('/auth/login', { method: 'POST', body: { email, password: 'newpassword99' } });
  check('login with new password', login.status === 200, JSON.stringify(login.json));
  const token2 = login.json.accessToken;

  const createFarm = await request('/farms', {
    method: 'POST', token: token2,
    body: { name: 'History Test Farm', size: '4', sizeUnit: 'hectares' },
  });
  check('create farm', createFarm.status === 201, JSON.stringify(createFarm.json));
  const farmId = createFarm.json.farm.id;
  const cat = await request('/categories', { token: token2 });
  const categoryId = cat.json.data && cat.json.data.length ? cat.json.data[0].id : null;
  check('GET /categories', Array.isArray(cat.json.data) && cat.json.data.length > 0, JSON.stringify(cat.json));

  let taskId = null;
  if (categoryId) {
    const createTask = await request('/tasks', {
      method: 'POST', token: token2,
      body: {
        title: 'History probe task', farmId,
        categoryId, priority: 'medium', status: 'todo',
      },
    });
    check('create task', createTask.status === 201, JSON.stringify(createTask.json));
    taskId = createTask.json.data.id;
  }

  const history1 = await request(`/history?farmId=${farmId}`, { token: token2 });
  check('GET /history has events', history1.status === 200 && history1.json.data.items.length >= 1, JSON.stringify(history1.json));
  const historyCat = await request('/history?action=created', { token: token2 });
  check('GET /history action filter', historyCat.status === 200 && historyCat.json.data.items.length >= 1, JSON.stringify(historyCat.json));

  const report = await request('/reports', { method: 'POST', token: token2, body: { reportType: 'tasks', format: 'csv', filters: { farmId } } });
  check('create CSV report', report.status === 201 && report.json.data.status === 'completed', JSON.stringify(report.json && report.json.data));
  const fileCheck = report.json.data.fileUrl ? await fetch(`http://localhost:4000${report.json.data.fileUrl}`) : null;
  check('report file downloadable', fileCheck && fileCheck.status === 200 && String(fileCheck.headers.get('content-type')).includes('csv'), String(fileCheck?.status));

  const analytics = await request('/analytics?rangeDays=0', { token: token2 });
  check('GET /analytics', analytics.status === 200 && analytics.json.data.kpis.total >= 1, JSON.stringify(analytics.json));

  const db = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await db.connect();
  if (taskId) await db.query('DELETE FROM tasks WHERE id = $1', [taskId]);
  await db.query('DELETE FROM farms WHERE id = $1', [farmId]);
  await db.query("DELETE FROM users WHERE email = $1", [email]);
  await db.end();
  console.log('  cleanup done');

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });