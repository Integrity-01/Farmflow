/* Live regression test for weather (Phase 14). */
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
  const email = `tmp-wx-${Date.now()}@example.com`;

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

  const withoutCoords = await request('/farms', {
    method: 'POST', token,
    body: { name: `Weather Plain Farm ${Date.now()}`, location: 'Kaduna, Nigeria' },
  });
  check('create farm without coords', withoutCoords.status === 201, JSON.stringify(withoutCoords.json));
  const plainFarmId = withoutCoords.json.farm.id;

  const withCoords = await request('/farms', {
    method: 'POST', token,
    body: { name: `Weather Coord Farm ${Date.now()}`, location: 'Kaduna, Nigeria', latitude: 9.06, longitude: 7.49 },
  });
  check('create farm with coords', withCoords.status === 201 && withCoords.json.farm.latitude === '9.060000', JSON.stringify(withCoords.json));
  const coordFarmId = withCoords.json.farm.id;

  const unauth = await fetch(`${BASE}/weather/${plainFarmId}`).catch(() => null);
  check('/weather 401 without token', unauth && unauth.status === 401, String(unauth?.status));

  const noCoords = await request(`/weather/${plainFarmId}`, { token });
  check(
    'farm without coords -> weather null NO_COORDINATES',
    noCoords.status === 200 && noCoords.json.weather === null && noCoords.json.reason === 'NO_COORDINATES',
    JSON.stringify(noCoords.json),
  );
  check('no-coords payload carries farm info', noCoords.json.farm?.name && noCoords.json.farm?.id === plainFarmId, JSON.stringify(noCoords.json));

  const coords = await request(`/weather/${coordFarmId}`, { token });
  const live = coords.json.weather?.source === 'open-meteo';
  check('farm with coords -> 200', coords.status === 200, JSON.stringify(coords.json));
  if (live) {
    check('live weather has current block', coords.json.weather.current && typeof coords.json.weather.current.temperature === 'number', JSON.stringify(coords.json.weather.current));
    check('live weather has 7-day daily', Array.isArray(coords.json.weather.daily) && coords.json.weather.daily.length === 7, JSON.stringify(coords.json.weather.daily?.length));
    check('live conditions mapped', ['clear', 'partly_cloudy', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'thunderstorm'].includes(coords.json.weather.current.condition), JSON.stringify(coords.json.weather.current.condition));
  } else {
    check('network unavailable -> graceful UNAVAILABLE', coords.json.reason === 'UNAVAILABLE', JSON.stringify(coords.json));
    console.log('  (skipped live assertions — weather provider unreachable)');
  }

  const missing = await request(`/weather/00000000-0000-0000-0000-000000000000`, { token });
  check('unknown farm -> 404', missing.status === 404, JSON.stringify(missing.json));

  const db = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await db.connect();
  await db.query('DELETE FROM farms WHERE id IN ($1, $2)', [plainFarmId, coordFarmId]);
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