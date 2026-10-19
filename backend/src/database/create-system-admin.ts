import { createConnection } from 'mysql2/promise';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { generateSystemAdminId } from '../utils/system-admin-id.js';
import { generateTemporaryPassword } from '../utils/password.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(dirname, '../../../.env') });

interface Args {
  name?: string;
  email?: string;
  password?: string;
  owner: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { owner: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--name') args.name = argv[++i];
    else if (token === '--email') args.email = argv[++i];
    else if (token === '--password') args.password = argv[++i];
    else if (token === '--owner') args.owner = true;
  }
  return args;
}

function ok(message: string) {
  console.log(`\x1b[32m\u2713\x1b[0m ${message}`);
}

function fail(message: string) {
  console.error(`\x1b[31m\xd7 ${message}\x1b[0m`);
}

const args = parseArgs(process.argv.slice(2));

if (!args.name) {
  fail('Usage: npm run system-admin:create -- --name "Full Name" [--email a@b.com] [--password secret] [--owner]');
  process.exit(1);
}

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

async function run() {
  const [countRows] = await connection.query(`SELECT COUNT(*) AS n FROM system_administrators`);
  const existing = Number((countRows as { n: number }[])[0]?.n ?? 0);

  // The first system administrator must be the owner; later ones default to
  // non-owner unless `--owner` is passed explicitly.
  const isOwner = existing === 0 ? true : args.owner;
  if (existing === 0) {
    console.log('No system administrators exist yet — creating the founding owner.');
  }

  const password = args.password ?? generateTemporaryPassword();
  const generated = !args.password;
  const passwordHash = await bcrypt.hash(password, 10);
  const email = args.email?.trim().toLowerCase() || null;

  let inserted = false;
  for (let attempt = 0; attempt < 6 && !inserted; attempt += 1) {
    const adminId = generateSystemAdminId();
    try {
      await connection.query(
        `INSERT INTO system_administrators
           (id, admin_id, name, email, password_hash, is_owner, must_change_password)
         VALUES (uuid(), ?, ?, ?, ?, ?, ?)`,
        [adminId, args.name!.trim(), email, passwordHash, isOwner ? 1 : 0, generated ? 1 : 0],
      );
      inserted = true;
      console.log('');
      ok('System administrator created.');
      console.log(`  System Administrator ID : ${adminId}`);
      if (email) console.log(`  Email                   : ${email}`);
      console.log(`  Role                    : ${isOwner ? 'Owner' : 'Administrator'}`);
      if (generated) {
        console.log(`  Temporary password      : ${password}`);
        console.log('  (Change this password after first sign-in.)');
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'ER_DUP_ENTRY' && email) {
        fail(`A system administrator with the email ${email} already exists.`);
        exitCode = 1;
        return;
      }
      if (code !== 'ER_DUP_ENTRY') throw error;
      // Admin ID collision — retry with a fresh one.
    }
  }

  if (!inserted) {
    fail('Could not allocate a unique System Administrator ID. Please try again.');
    exitCode = 1;
  }
}

run()
  .catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
    exitCode = 1;
  })
  .finally(async () => {
    await connection.end();
    process.exit(exitCode);
  });
