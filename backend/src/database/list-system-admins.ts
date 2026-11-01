import { createConnection } from 'mysql2/promise';
import { buildConnectionConfig } from './connection-config.js';

interface SystemAdminRow {
  admin_id: string;
  name: string;
  email: string | null;
  status: string;
  is_owner: number;
  mfa_enabled: number;
  must_change_password: number;
  failed_login_count: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  created_at: Date;
}

function ok(message: string) {
  console.log(`\x1b[32m\u2713\x1b[0m ${message}`);
}

function fail(message: string) {
  console.error(`\x1b[31m\u2717\x1b[0m ${message}\x1b[0m`);
}

function formatDate(value: Date | null): string {
  if (!value) return 'never';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown' : date.toISOString();
}

const connection = await createConnection(buildConnectionConfig());

async function run() {
  const [rows] = await connection.query(
    `SELECT admin_id, name, email, status, is_owner, mfa_enabled, must_change_password,
            failed_login_count, locked_until, last_login_at, created_at
       FROM system_administrators
      ORDER BY is_owner DESC, created_at ASC`,
  );

  const admins = rows as SystemAdminRow[];

  if (admins.length === 0) {
    console.log('');
    fail('No system administrators exist yet.');
    console.log('  Create the founding owner with:');
    console.log('    npm run system-admin:create -w backend -- --name "Full Name" [--email a@b.com]');
    return;
  }

  console.log('');
  ok(`${admins.length} system administrator(s):`);
  console.log('');

  for (const admin of admins) {
    const flags = [
      admin.is_owner ? 'owner' : 'administrator',
      admin.status,
      admin.mfa_enabled ? 'mfa' : 'no-mfa',
      admin.must_change_password ? 'must-change-password' : null,
      admin.failed_login_count > 0 ? `failed-logins:${admin.failed_login_count}` : null,
      admin.locked_until ? 'locked' : null,
    ].filter(Boolean);

    console.log(`  ${admin.admin_id}`);
    console.log(`    Name        : ${admin.name}`);
    console.log(`    Email       : ${admin.email ?? '(none)'}`);
    console.log(`    Flags       : ${flags.join(', ')}`);
    console.log(`    Created     : ${formatDate(admin.created_at)}`);
    console.log(`    Last login  : ${formatDate(admin.last_login_at)}`);
    console.log('');
  }
}

run()
  .catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await connection.end();
  });
