/* Live end-to-end test for task attachment upload (backend + Apache proxy). */
const API = 'http://localhost:4000/api';
const WEB = 'http://localhost:8080';
let pass = 0;
let fail = 0;

function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

async function request(path, { method = 'GET', token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function main() {
  const email = `tmp-at-${Date.now()}@example.com`;
  const reg = await request('/auth/register', {
    method: 'POST',
    body: { name: 'Temp Admin', email, password: 'test12345' },
  });
  check('register admin', reg.status === 201 && !!reg.json.user.id, JSON.stringify(reg.json));
  const token = reg.json.accessToken;

  const { Client } = require('./db-shim.cjs');
  const db = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await db.connect();
  await db.query('UPDATE users SET role = $1 WHERE id = $2', ['administrator', reg.json.user.id]);
  await db.end();

  const farm = await request('/farms', { method: 'POST', token, body: { name: `Attach Farm ${Date.now()}` } });
  check('create farm', farm.status === 201, JSON.stringify(farm.json));
  const farmId = farm.json.farm.id;

  const cats = await request('/categories', { token });
  const list = Array.isArray(cats.json?.data) ? cats.json.data : cats.json?.categories ?? [];
  const categoryId = list[0].id;

  const task = await request('/tasks', {
    method: 'POST', token,
    body: { title: 'Attachment test task', farmId, categoryId },
  });
  check('create task', task.status === 201 && !!task.json.data?.id, JSON.stringify(task.json));
  const taskId = task.json.data.id;

  const unauth = await fetch(`${API}/tasks/${taskId}/attachments`, { method: 'POST' }).catch(() => null);
  check('upload 401 without token', unauth && unauth.status === 401, String(unauth?.status));

  const buf = Buffer.from('attachment-content-line-42\n');
  const form = new FormData();
  form.append('file', new File([buf], 'scouting-note.txt', { type: 'text/plain' }));

  const up = await fetch(`${API}/tasks/${taskId}/attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const upj = await up.json().catch(() => null);
  check('upload -> 201', up.status === 201, JSON.stringify(upj));
  const url = upj?.data?.url;
  check('attachment carries url', typeof url === 'string' && url.startsWith('/uploads/'), JSON.stringify(upj));
  const attachId = upj?.data?.id;
  check('attachment carries id', typeof attachId === 'string', JSON.stringify(upj));
  check('attachment metadata', upj?.data?.fileName === 'scouting-note.txt' && upj?.data?.fileType === 'text/plain', JSON.stringify(upj));

  const viaApi = await fetch(`http://localhost:4000${url}`).catch(() => null);
  check('file served via API origin', viaApi && viaApi.status === 200, String(viaApi?.status));

  const viaWeb = await fetch(`${WEB}${url}`).catch(() => null);
  const body = viaWeb ? await viaWeb.text().catch(() => '') : '';
  check('file served through Apache /uploads -> 200', viaWeb && viaWeb.status === 200, String(viaWeb?.status));
  check('file content matches', body.includes('attachment-content-line-42'), JSON.stringify(body));

  const del = await fetch(`${API}/tasks/attachments/${attachId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  check('delete attachment -> 204', del.status === 204, String(del.status));

  const gone = await fetch(`${WEB}${url}`).catch(() => null);
  check('file gone after delete (Apache 404)', gone && gone.status === 404, String(gone?.status));

  await request(`/tasks/${taskId}`, { method: 'DELETE', token });
  await request(`/farms/${farmId}`, { method: 'DELETE', token });

  const db2 = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await db2.connect();
  await db2.query('DELETE FROM users WHERE email = $1', [email]);
  await db2.end();
  console.log('  cleanup done');

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});