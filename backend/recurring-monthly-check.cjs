const BASE = 'http://localhost:4000/api';
async function call(path, { token, body, method = 'POST' } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}
(async () => {
  const reg = await call('/auth/register', {
    body: { name: 'Recurring Admin', email: `tmp-recurring-${Date.now()}@example.com`, password: 'Passw0rd!123' },
  });
  const token = reg.data.accessToken;
  const { Client } = require('./db-shim.cjs');
  const promote = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await promote.connect();
  await promote.query('UPDATE users SET role = $1 WHERE id = $2', ['administrator', reg.data.user.id]);
  await promote.end();
  const farm = await call('/farms', { token, body: { name: 'Recurring Test Farm', location: '', status: 'active', managerId: reg.data.user.id } });
  const fid = farm.data.farm.id;
  const cats = await call('/categories', { token, method: 'GET' });
  const catId = cats.data.data[0].id;
  const today = new Date().toISOString().slice(0, 10);
  const ok = await call('/recurring-tasks', {
    token,
    body: { title: 'Monthly Scout', farmId: fid, categoryId: catId, frequency: 'monthly', dayOfMonth: 15, startDate: today },
  });
  console.log('ok resp:', ok.status, JSON.stringify(ok.data).slice(0, 260));
  const bad = await call('/recurring-tasks', {
    token,
    body: { title: 'Bad Monthly', farmId: fid, categoryId: catId, frequency: 'monthly', startDate: today },
  });
  const del = await call(`/recurring-tasks/${ok.data.data.id}`, { token, method: 'DELETE' });
  const gone = await call(`/recurring-tasks/${ok.data.data.id}`, { token, method: 'GET' });
  const fg = await call('/recurring-tasks/missing/generate', { token });
  const okShape = ok.status === 201 && ok.data.data.frequency === 'monthly' && ok.data.data.dayOfMonth === 15 && ok.data.data.weekdays.length === 0 && ok.data.data.active === true && ok.data.data.nextRunAt !== null;
  console.log('monthly create:', okShape ? 'PASS' : `FAIL (${ok.status} ${JSON.stringify(ok.data)})`);
  console.log('monthly missing dayOfMonth -> validation:', bad.status === 400 && bad.data.code === 'VALIDATION_ERROR' ? 'PASS' : `FAIL (${bad.status} ${bad.data && bad.data.code})`);
  console.log('delete:', del.status === 204 ? 'PASS' : `FAIL (${del.status})`);
  console.log('rule gone after delete:', gone.status === 404 ? 'PASS' : `FAIL (${gone.status})`);
  console.log('generate unknown id -> 404:', fg.status === 404 ? 'PASS' : `FAIL (${fg.status})`);
  const c = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await c.connect();
  const safe = async (sql, args) => { try { await c.query(sql, args); } catch (e) { console.log('cleanup skip:', e.message.slice(0, 60)); } };
  await safe('DELETE FROM farms WHERE id = $1', [fid]);
  await safe("DELETE FROM users WHERE email LIKE 'tmp-%'");
  await c.end();
  console.log('cleanup done');
})().catch((e) => {
  console.error('ERROR', e);
  process.exit(1);
});