// Live integration test for the Admin ID authentication system.
// Requires the API (node dist/server.js) and MySQL to be running, and the
// migrations (through 012) to be applied:  npm run migrate
//   Run:  npm run test:live   (from backend/)
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
  const stamp = Date.now();
  const email = `tmp-admin-${stamp}@example.com`;
  const password = 'test12345';
  const orgName = `Admin ID Test Org ${stamp}`;

  // 1. Create an organization -> first administrator receives an Admin ID.
  const created = await request('/auth/organizations', {
    method: 'POST',
    body: { organizationName: orgName, name: 'Temp Admin', email, password },
  });
  check(
    'createOrganization returns an Admin ID',
    created.status === 201 && /^FF-ADM-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(created.json.adminId || ''),
    JSON.stringify(created.json),
  );
  const adminId = created.json.adminId;
  const adminToken = created.json.accessToken;
  const orgId = created.json.organization && created.json.organization.id;
  const userId = created.json.user && created.json.user.id;
  const originalKey = created.json.accessKey;

  if (!adminId || !adminToken || !orgId || !userId) {
    console.log('\nRESULT: setup failed, aborting');
    process.exit(1);
  }

  // 2. Admin login succeeds and is tolerant of lowercase / missing dashes.
  const messyId = adminId.toLowerCase().replace(/-/g, ' ');
  const okLogin = await request('/auth/admin-login', {
    method: 'POST',
    body: { adminId: messyId, password },
  });
  check(
    'admin-login succeeds (normalized Admin ID) with admin role',
    okLogin.status === 200 &&
      okLogin.json.user &&
      okLogin.json.user.role === 'organization_administrator' &&
      !!okLogin.json.accessToken,
    JSON.stringify(okLogin.json),
  );

  // 3. Wrong password -> generic 401, never reveals the account.
  const wrongPw = await request('/auth/admin-login', {
    method: 'POST',
    body: { adminId, password: 'definitely-wrong' },
  });
  check(
    'admin-login wrong password -> 401 INVALID_CREDENTIALS',
    wrongPw.status === 401 && wrongPw.json.code === 'INVALID_CREDENTIALS',
    JSON.stringify(wrongPw.json),
  );

  // 4. Unknown Admin ID -> same generic 401 (no enumeration).
  const unknown = await request('/auth/admin-login', {
    method: 'POST',
    body: { adminId: 'FF-ADM-ZZZZ-ZZZZ', password },
  });
  check(
    'admin-login unknown Admin ID -> 401 INVALID_CREDENTIALS',
    unknown.status === 401 && unknown.json.code === 'INVALID_CREDENTIALS',
    JSON.stringify(unknown.json),
  );

  // 5. List Admin IDs for the organization.
  const creds = await request('/organizations/admin-credentials', { token: adminToken });
  check(
    'GET /organizations/admin-credentials lists the Admin ID',
    creds.status === 200 &&
      Array.isArray(creds.json.credentials) &&
      creds.json.credentials.some((c) => c.adminId === adminId && c.status === 'active'),
    JSON.stringify(creds.json),
  );

  // 6. Rotate the access key: old key revoked, new key valid.
  const rotated = await request('/organizations/access-keys/rotate', {
    method: 'POST',
    token: adminToken,
  });
  check('POST /organizations/access-keys/rotate returns a new key', rotated.status === 200 && !!rotated.json.accessKey, JSON.stringify(rotated.json));
  const newKey = rotated.json.accessKey;

  const oldKeyCheck = await request('/auth/verify-organization-key', {
    method: 'POST',
    body: { accessKey: originalKey },
  });
  check('old access key is revoked after rotation', oldKeyCheck.status >= 400, String(oldKeyCheck.status));

  const newKeyCheck = await request('/auth/verify-organization-key', {
    method: 'POST',
    body: { accessKey: newKey },
  });
  check('new access key is valid after rotation', newKeyCheck.status === 200, JSON.stringify(newKeyCheck.json));

  // 7. Disabling admin access revokes Admin ID login.
  const { Client } = require('./db-shim.cjs');
  const db = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await db.connect();

  await db.query("UPDATE administrator_login_credentials SET status = 'disabled' WHERE admin_id = $1", [adminId]);
  const disabledLogin = await request('/auth/admin-login', { method: 'POST', body: { adminId, password } });
  check(
    'disabled Admin ID cannot sign in -> 403',
    disabledLogin.status === 403 && disabledLogin.json.code === 'ACCOUNT_DISABLED',
    JSON.stringify(disabledLogin.json),
  );

  // Cleanup: remove every row created by this test.
  await db.query('DELETE FROM administrator_login_credentials WHERE organization_id = $1', [orgId]);
  await db.query('DELETE FROM audit_logs WHERE organization_id = $1', [orgId]);
  await db.query('DELETE FROM organization_memberships WHERE organization_id = $1', [orgId]);
  await db.query('DELETE FROM access_keys WHERE organization_id = $1', [orgId]);
  await db.query('UPDATE sessions SET active_organization_id = NULL WHERE active_organization_id = $1', [orgId]);
  await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  await db.query('DELETE FROM notification_preferences WHERE user_id = $1', [userId]);
  await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
  await db.query('DELETE FROM users WHERE id = $1', [userId]);
  await db.end();
  console.log('  cleanup done');

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
