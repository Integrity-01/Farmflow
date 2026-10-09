/* Live end-to-end validation for the WhatsApp layer (degraded, no creds set).
 * Verifies auth gates, not-configured responses, the invite/send 503 path,
 * webhook handshake + event rejection, prefs persistence and DB schema. */
const API = 'http://localhost:4000/api';
let pass = 0;
let fail = 0;

function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function main() {
  console.log('whatsapp-live: auth gates');

  const anonStatus = await request('/whatsapp/status');
  check('status requires auth', anonStatus.status === 401, JSON.stringify(anonStatus.json));

  const anonInvite = await request('/whatsapp/invite', { method: 'POST' });
  check('invite requires auth', anonInvite.status === 401, JSON.stringify(anonInvite.json));

  const anonSend = await request('/whatsapp/send', { method: 'POST', body: { to: '+2348012345678', message: 'hi' } });
  check('send requires auth', anonSend.status === 401, JSON.stringify(anonSend.json));

  console.log('whatsapp-live: webhook (public)');

  const wrongToken = await request('/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc');
  check('handshake rejects wrong verify token', wrongToken.status === 403, JSON.stringify(wrongToken.json));

  const noToken = await request('/whatsapp/webhook?hub.mode=subscribe&hub.challenge=abc');
  check('handshake rejects missing token', noToken.status === 403, JSON.stringify(noToken.json));

  const eventNoSig = await request('/whatsapp/webhook', {
    method: 'POST',
    body: { entry: [{ changes: [{ value: { messages: [{ from: '2348012345678', text: { body: 'hi' } }] } }] }] },
  });
  check(
    'event rejects unconfigured+unsigned',
    eventNoSig.status === 503 && eventNoSig.json?.code === 'WHATSAPP_NOT_CONFIGURED',
    JSON.stringify(eventNoSig.json),
  );

  console.log('whatsapp-live: authenticated (not configured)');

  const email = `tmp-wa-${Date.now()}@example.com`;
  const reg = await request('/auth/register', {
    method: 'POST',
    body: { name: 'Temp WA User', email, password: 'test12345' },
  });
  check('register user', reg.status === 201 && !!reg.json.user.id, JSON.stringify(reg.json));
  const token = reg.json.accessToken;

  const status = await request('/whatsapp/status', { token });
  check(
    'status reports not configured',
    status.status === 200 && status.json?.data?.configured === false &&
      status.json?.data?.status === null && status.json?.data?.number === null,
    JSON.stringify(status.json),
  );

  const invite = await request('/whatsapp/invite', { method: 'POST', token });
  check(
    'invite returns WHATSAPP_NOT_CONFIGURED',
    invite.status === 503 && invite.json?.code === 'WHATSAPP_NOT_CONFIGURED',
    JSON.stringify(invite.json),
  );

  const badSend = await request('/whatsapp/send', { method: 'POST', token, body: { to: 'abc', message: '' } });
  check('send validates input', badSend.status === 400, JSON.stringify(badSend.json));

  const send = await request('/whatsapp/send', { method: 'POST', token, body: { to: '+2348012345678', message: 'hello' } });
  check(
    'send returns WHATSAPP_NOT_CONFIGURED',
    send.status === 503 && send.json?.code === 'WHATSAPP_NOT_CONFIGURED',
    JSON.stringify(send.json),
  );

  console.log('whatsapp-live: prefs + schema');

  const patch = await request('/settings/notifications', { method: 'PATCH', token, body: { whatsappEnabled: true } });
  check(
    'prefs accept whatsappEnabled',
    patch.status === 200 && patch.json?.data?.whatsappEnabled === true,
    JSON.stringify(patch.json),
  );

  const get = await request('/settings/notifications', { token });
  check('prefs persist whatsappEnabled', get.status === 200 && get.json?.data?.whatsappEnabled === true, JSON.stringify(get.json));

  await request('/settings/notifications', { method: 'PATCH', token, body: { whatsappEnabled: false } });

  const { Client } = require('./db-shim.cjs');
  const db = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await db.connect();
  const table = await db.query(`SELECT COUNT(*) AS count FROM information_schema.tables
    WHERE table_schema = 'farmflow' AND table_name = 'whatsapp_links'`);
  check('whatsapp_links table exists', Number(table.rows[0].count) === 1, JSON.stringify(table.rows));
  const col = await db.query(`SELECT COUNT(*) AS count FROM information_schema.columns
    WHERE table_schema = 'farmflow' AND table_name = 'notification_preferences'
    AND column_name = 'whatsapp_enabled'`);
  check('whatsapp_enabled column exists', Number(col.rows[0].count) === 1, JSON.stringify(col.rows));
  await db.end();

  console.log(`\nwhatsapp-live: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});