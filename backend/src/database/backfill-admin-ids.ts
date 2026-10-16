import { createConnection } from 'mysql2/promise';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { generateAdminId } from '../utils/admin-id.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(dirname, '../../../.env') });

const connection = await createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'farmflow',
  charset: 'utf8mb4',
  timezone: 'local',
});

let exitCode = 0;

function ok(message: string) {
  console.log(`\x1b[32m\u2713\x1b[0m ${message}`);
}

function fail(message: string) {
  console.error(`\x1b[31m\xd7 ${message}\x1b[0m`);
}

/**
 * Backfill Admin IDs for every active organization administrator that does not
 * yet have a login credential (i.e. administrators created before the Admin ID
 * system existed). Safe to run multiple times: it only inserts missing rows.
 */
async function backfill() {
  console.log('Backfilling administrator login credentials (Admin IDs)...');

  const [rows] = await connection.query(
    `SELECT m.user_id, m.organization_id
     FROM organization_memberships m
     JOIN roles r ON r.id = m.role_id
     LEFT JOIN administrator_login_credentials c
       ON c.user_id = m.user_id AND c.organization_id = m.organization_id
     WHERE r.code = 'organization_administrator'
       AND m.status = 'active'
       AND c.id IS NULL`,
  );

  const targets = rows as { user_id: string; organization_id: string }[];
  if (targets.length === 0) {
    ok('no administrators require an Admin ID');
    return;
  }

  let created = 0;
  for (const target of targets) {
    let inserted = false;
    for (let attempt = 0; attempt < 6 && !inserted; attempt += 1) {
      const adminId = generateAdminId();
      try {
        await connection.query(
          `INSERT INTO administrator_login_credentials (admin_id, user_id, organization_id)
           VALUES (?, ?, ?)`,
          [adminId, target.user_id, target.organization_id],
        );
        inserted = true;
        created += 1;
        ok(`issued ${adminId} to user ${target.user_id} in org ${target.organization_id}`);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== 'ER_DUP_ENTRY') throw error;
        // admin_id collided - retry with a fresh one.
      }
    }
    if (!inserted) {
      fail(`could not allocate an Admin ID for user ${target.user_id}`);
      exitCode = 1;
    }
  }

  ok(`issued ${created} Admin ID(s)`);
}

backfill()
  .catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
    exitCode = 1;
  })
  .finally(async () => {
    await connection.end();
    process.exit(exitCode);
  });
