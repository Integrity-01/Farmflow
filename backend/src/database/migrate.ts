import { createConnection } from 'mysql2/promise';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(dirname, '../../../database/migrations');

config({ path: path.resolve(dirname, '../../../.env') });

const connection = await createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'farmflow',
  multipleStatements: true,
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

async function migrate() {
  console.log('Running FarmFlow database migrations...');
  console.log('Migrations directory:', migrationsDir);

  await connection.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name VARCHAR(255) PRIMARY KEY,
       applied_at DATETIME NOT NULL DEFAULT now()
     )`,
  );

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const [appliedRows] = await connection.query('SELECT name FROM schema_migrations');
  const applied = new Set(
    (appliedRows as { name: string }[]).map((row) => row.name as string),
  );

  let count = 0;

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await readFile(path.join(migrationsDir, file), 'utf8');

    try {
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      ok(`applied ${file}`);
      count += 1;
    } catch (error) {
      throw new Error(`Migration "${file}" failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (count === 0) {
    ok('database is up to date');
  } else {
    ok(`applied ${count} migration(s)`);
  }
}

migrate()
  .catch((error) => {
    if (error instanceof Error) {
      fail(error.message);
    } else {
      fail(String(error));
    }
    exitCode = 1;
  })
  .finally(async () => {
    await connection.end();
    process.exit(exitCode);
  });