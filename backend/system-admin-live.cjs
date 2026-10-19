// Live integration tests for the Central System Administrator environment.
// Requires the API (node dist/server.js) and MySQL to be running, and the
// migrations (through 013) applied:  npm run migrate
//   Run:  node system-admin-live.cjs   (from backend/)
const BASE = 'http://localhost:4000/api';
const bcrypt = require('bcryptjs');

let pass = 0;
let fail = 0;

function check(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name} ${extra}`);
  }
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
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
}

const SYSTEM_ADMIN_ID = 'FF-SYS-TEST-ABCD';
const SYSTEM_PASSWORD = 'SystemTest123!';

async function main() {
  const stamp = Date.now();
  const email = `tmp-sysorg-${stamp}@example.com`;
  const password = 'test12345';
  const orgName = `System Admin Test Org ${stamp}`;

  // --- Seed a real tenant through the public API ---
  const created = await request('/auth/organizations', {
    method: 'POST',
    body: { organizationName: orgName, name: 'Temp Owner', email, password },
  });
  const orgId = created.json?.organization?.id;
  const userId = created.json?.user?.id;
  const accessKey = created.json?.accessKey;
  const tenantToken = created.json?.accessToken;
  if (!orgId || !userId || !accessKey || !tenantToken) {
    console.log('RESULT: setup failed, aborting', JSON.stringify(created.json));
    process.exit(1);
  }

  // --- Seed a system administrator directly (provisioning path is the CLI) ---
  const { Client } = require('./db-shim.cjs');
  const db = new Client({ connectionString: 'mysql://root:@localhost:3306/farmflow' });
  await db.connect();
  const hash = await bcrypt.hash(SYSTEM_PASSWORD, 10);
  await db.query(
    `INSERT INTO system_administrators (id, admin_id, name, email, password_hash, is_owner)
     VALUES (uuid(), $1, 'Live Tester', $2, $3, 1)`,
    [SYSTEM_ADMIN_ID, `live-${stamp}@example.com`, hash],
  );
  const sysRow = await db.query(
    `SELECT id FROM system_administrators WHERE admin_id = $1`,
    [SYSTEM_ADMIN_ID],
  );
  const sysId = sysRow.rows[0].id;

  // 1. Wrong password -> generic 401.
  const wrong = await request('/system/auth/login', {
    method: 'POST',
    body: { adminId: SYSTEM_ADMIN_ID, password: 'wrong-password' },
  });
  check(
    'system login wrong password -> 401 INVALID_CREDENTIALS',
    wrong.status === 401 && wrong.json.code === 'INVALID_CREDENTIALS',
    JSON.stringify(wrong.json),
  );

  // 2. Hyphen-free, lowercase input is accepted and normalized.
  const messy = SYSTEM_ADMIN_ID.toLowerCase().replace(/-/g, '');
  const login = await request('/system/auth/login', {
    method: 'POST',
    body: { adminId: messy, password: SYSTEM_PASSWORD },
  });
  check(
    'system login accepts a raw 13-char (no hyphen) ID and returns a token',
    login.status === 200 && !!login.json.accessToken && login.json.user?.adminId === SYSTEM_ADMIN_ID,
    JSON.stringify(login.json),
  );
  const sysToken = login.json?.accessToken;

  // 3. No auth -> 401.
  const noAuth = await request('/system/overview');
  check('GET /system/overview without a token -> 401', noAuth.status === 401, String(noAuth.status));

  // 4. A tenant token is rejected by the system namespace.
  const tenantOnSystem = await request('/system/overview', { token: tenantToken });
  check(
    'tenant access token rejected by /system -> 401',
    tenantOnSystem.status === 401,
    String(tenantOnSystem.status),
  );

  // 5. A system token is rejected by the tenant namespace.
  const systemOnTenant = await request('/auth/me', { token: sysToken });
  check(
    'system access token rejected by /auth/me -> 401',
    systemOnTenant.status === 401,
    String(systemOnTenant.status),
  );

  // 6. Overview returns real aggregate data including the seeded org.
  const overview = await request('/system/overview', { token: sysToken });
  check(
    'GET /system/overview returns aggregate stats',
    overview.status === 200 && overview.json.stats.organizations >= 1 && overview.json.stats.users >= 1,
    JSON.stringify(overview.json?.stats),
  );

  // 7. Organization search finds the seeded org with member count.
  const search = await request(`/system/organizations?search=${encodeURIComponent(orgName)}`, {
    token: sysToken,
  });
  check(
    'GET /system/organizations?search returns the seeded org',
    search.status === 200 &&
      search.json.total === 1 &&
      search.json.items[0].id === orgId &&
      search.json.items[0].memberCount === 1,
    JSON.stringify(search.json),
  );

  // 8. Organization detail returns counts + members.
  const detail = await request(`/system/organizations/${orgId}`, { token: sysToken });
  check(
    'GET /system/organizations/:id returns counts and members',
    detail.status === 200 && detail.json.counts.members === 1 && detail.json.members.length === 1,
    JSON.stringify(detail.json?.counts),
  );

  // 9. Suspend the organization.
  const suspend = await request(`/system/organizations/${orgId}/suspend`, {
    method: 'POST',
    token: sysToken,
  });
  check(
    'POST /system/organizations/:id/suspend sets status',
    suspend.status === 200 && suspend.json.status === 'suspended',
    JSON.stringify(suspend.json),
  );

  // 10. Suspension preserves data.
  const afterSuspend = await request(`/system/organizations/${orgId}`, { token: sysToken });
  check(
    'suspension preserves organization data (members intact)',
    afterSuspend.status === 200 &&
      afterSuspend.json.status === 'suspended' &&
      afterSuspend.json.counts.members === 1,
    JSON.stringify(afterSuspend.json?.counts),
  );

  // 11. A suspended organization's members can no longer use its key.
  const keyAfterSuspend = await request('/auth/verify-organization-key', {
    method: 'POST',
    body: { accessKey },
  });
  check(
    'suspended organization key is rejected -> 400',
    keyAfterSuspend.status === 400,
    String(keyAfterSuspend.status),
  );

  // 12. Reactivate.
  const activate = await request(`/system/organizations/${orgId}/activate`, {
    method: 'POST',
    token: sysToken,
  });
  check(
    'POST /system/organizations/:id/activate restores status',
    activate.status === 200 && activate.json.status === 'active',
    JSON.stringify(activate.json),
  );

  const keyAfterActivate = await request('/auth/verify-organization-key', {
    method: 'POST',
    body: { accessKey },
  });
  check(
    'reactivated organization key works again -> 200',
    keyAfterActivate.status === 200,
    String(keyAfterActivate.status),
  );

  // 13. Global user search finds the seeded user (deduped membership count).
  const users = await request(`/system/users?search=${encodeURIComponent(email)}`, { token: sysToken });
  check(
    'GET /system/users?search returns the seeded user once',
    users.status === 200 && users.json.total === 1 && users.json.items[0].id === userId,
    JSON.stringify(users.json),
  );

  // 14. Analytics returns a continuous series for the requested window.
  const analytics = await request('/system/analytics?range=7d', { token: sysToken });
  check(
    'GET /system/analytics?range=7d returns a 7-point series',
    analytics.status === 200 && analytics.json.series.length === 7 && analytics.json.range.days === 7,
    JSON.stringify(analytics.json?.range),
  );

  // 15. Audit log records the platform actions.
  const audit = await request('/system/audit-logs?pageSize=50', { token: sysToken });
  const actions = (audit.json?.items ?? []).map((item) => item.action);
  check(
    'audit log records system login + org suspend/activate',
    audit.status === 200 &&
      actions.includes('system_admin.login') &&
      actions.includes('system_admin.organization_suspended') &&
      actions.includes('system_admin.organization_activated'),
    JSON.stringify(actions),
  );
  check(
    'audit entries are attributed to a system admin actor',
    (audit.json?.items ?? []).some((item) => item.actorType === 'system_admin' && item.actorName),
    JSON.stringify(audit.json?.items?.[0]),
  );

  // 16. Health endpoint surfaces platform counts.
  const health = await request('/system/health', { token: sysToken });
  check(
    'GET /system/health returns uptime + counts',
    health.status === 200 &&
      health.json.health.status === 'ok' &&
      health.json.systemAdministrators >= 1,
    JSON.stringify(health.json),
  );

  // 17. Logout revokes the refresh session.
  const logout = await request('/system/auth/logout', { method: 'POST', token: sysToken });
  check('POST /system/auth/logout -> 204', logout.status === 204, String(logout.status));

  // --- Cleanup everything this test created ---
  await db.query('DELETE FROM system_admin_sessions WHERE system_admin_id = $1', [sysId]);
  await db.query('DELETE FROM system_admin_password_resets WHERE system_admin_id = $1', [sysId]);
  await db.query('DELETE FROM system_administrators WHERE id = $1', [sysId]);
  await db.query('DELETE FROM audit_logs WHERE actor_admin_id = $1', [sysId]);
  await db.query('DELETE FROM audit_logs WHERE organization_id = $1', [orgId]);
  await db.query('DELETE FROM administrator_login_credentials WHERE organization_id = $1', [orgId]);
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
