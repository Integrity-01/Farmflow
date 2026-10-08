/* Live regression test for inventory/inputs (Phase 13). */
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
  const email = `tmp-inv-${Date.now()}@example.com`;

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

  const farm = await request('/farms', {
    method: 'POST', token,
    body: { name: `Inventory Test Farm ${Date.now()}`, size: '4', sizeUnit: 'hectares' },
  });
  check('create farm', farm.status === 201, JSON.stringify(farm.json));
  const farmId = farm.json.farm.id;

  const unauth = await request('/inventory');
  check('/inventory 401 without token', unauth.status === 401, String(unauth.status));

  const created = await request('/inventory', {
    method: 'POST', token,
    body: { farmId, name: 'NPK 20-10-10', type: 'fertilizer', unit: 'kg', quantity: 50, lowStockThreshold: 10, unitCost: 2000, supplier: 'Agro Depot' },
  });
  check('create input', created.status === 201 && created.json.input.name === 'NPK 20-10-10', JSON.stringify(created.json));
  const inputId = created.json.input.id;

  const dup = await request('/inventory', {
    method: 'POST', token,
    body: { farmId, name: 'NPK 20-10-10', type: 'fertilizer', unit: 'kg' },
  });
  check('duplicate input name -> 409', dup.status === 409 && dup.json.code === 'NAME_TAKEN', JSON.stringify(dup.json));

  const badFarm = await request('/inventory', {
    method: 'POST', token,
    body: { farmId: '00000000-0000-0000-0000-000000000000', name: 'Ghost input', type: 'seed', unit: 'kg' },
  });
  check('invalid farm -> 404', badFarm.status === 404, JSON.stringify(badFarm.json));

  const list = await request('/inventory?search=NPK&page=1&pageSize=10', { token });
  check(
    'list texts search + farm scoping',
    list.status === 200 && Array.isArray(list.json.items) && list.json.items[0]?.id === inputId,
    JSON.stringify(list.json),
  );

  const listed = await request('/inventory', { token });
  check('list has farm name + stock', listed.json.items[0]?.farmName && listed.json.items[0]?.stock === 'in_stock', JSON.stringify(listed.json));

  const lowList = await request('/inventory?stock=low', { token });
  check('stock=low filter excludes in-stock item', lowList.status === 200 && lowList.json.items.length === 0, JSON.stringify(lowList.json));

  const outList = await request('/inventory?stock=out', { token });
  check('stock=out filter empty', outList.status === 200 && outList.json.items.length === 0, JSON.stringify(outList.json));

  const adjust = await request(`/inventory/${inputId}/adjust`, {
    method: 'POST', token,
    body: { change: 25, note: 'Weekly restock' },
  });
  check('adjust +25 -> quantity 75', adjust.status === 200 && Number(adjust.json.input.quantity) === 75, JSON.stringify(adjust.json));

  const overdraw = await request(`/inventory/${inputId}/adjust`, {
    method: 'POST', token,
    body: { change: -200 },
  });
  check('overdraw -> 400 INSUFFICIENT_STOCK', overdraw.status === 400 && overdraw.json.code === 'INSUFFICIENT_STOCK', JSON.stringify(overdraw.json));

  const use = await request(`/inventory/${inputId}/adjust`, {
    method: 'POST', token,
    body: { change: -73, note: 'Fertilized field A' },
  });
  check('adjust -73 -> quantity 2 (low)', use.status === 200 && Number(use.json.input.quantity) === 2 && use.json.input.stock === 'low', JSON.stringify(use.json));

  const lowList2 = await request('/inventory?stock=low', { token });
  check('stock=low now shows item', lowList2.json.items.some((i) => i.id === inputId), JSON.stringify(lowList2.json));

  const movements = await request(`/inventory/${inputId}/movements?page=1&pageSize=10`, { token });
  check(
    'movements logged in order',
    movements.status === 200 && movements.json.items.length === 2 && Number(movements.json.items[0].change) === -73,
    JSON.stringify(movements.json),
  );

  const updated = await request(`/inventory/${inputId}`, {
    method: 'PATCH', token,
    body: { supplier: 'New Supplier Ltd', lowStockThreshold: 5 },
  });
  check('update input', updated.status === 200 && updated.json.input.supplier === 'New Supplier Ltd', JSON.stringify(updated.json));

  const got = await request(`/inventory/${inputId}`, { token });
  check('get single input', got.status === 200 && got.json.input.id === inputId, JSON.stringify(got.json));

  const del = await request(`/inventory/${inputId}`, { method: 'DELETE', token });
  check('delete input -> 204', del.status === 204, String(del.status));

  const after = await request(`/inventory/${inputId}`, { token });
  check('gone after delete -> 404', after.status === 404, String(after.status));

  const db = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await db.connect();
  await db.query('DELETE FROM farms WHERE id = $1', [farmId]);
  await db.query('DELETE FROM users WHERE email = $1', [email]);
  await db.end();
  console.log('  cleanup done');

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});