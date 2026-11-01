import { systemAdminService } from '../services/system-admin.service.js';
import { generateTemporaryPassword } from '../utils/password.js';

interface Args {
  adminId?: string;
  email?: string;
  password?: string;
  mustChange: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { mustChange: true };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--admin-id') args.adminId = argv[++i];
    else if (token === '--email') args.email = argv[++i];
    else if (token === '--password') args.password = argv[++i];
    else if (token === '--no-must-change') args.mustChange = false;
  }
  return args;
}

function ok(message: string) {
  console.log(`\x1b[32m\u2713\x1b[0m ${message}`);
}

function fail(message: string) {
  console.error(`\x1b[31m\u2717\x1b[0m ${message}\x1b[0m`);
}

const args = parseArgs(process.argv.slice(2));

if (!args.adminId && !args.email) {
  fail('Usage: npm run system-admin:set-password -- --admin-id FF-SYS-XXXX-XXXX [--email a@b.com] [--password secret] [--no-must-change]');
  process.exit(1);
}

async function run() {
  const byId = args.adminId
    ? await systemAdminService.findByAdminId(args.adminId)
    : null;
  const byEmail = byId
    ? null
    : (await systemAdminService.listAdmins()).find(
        (admin) => admin.email?.toLowerCase() === args.email!.trim().toLowerCase(),
      );

  const target = byId ?? byEmail;

  if (!target) {
    fail(
      `No system administrator found for ${
        args.adminId ? `ID "${args.adminId}"` : `email "${args.email}"`
      }.`,
    );
    process.exitCode = 1;
    return;
  }

  const password = args.password ?? generateTemporaryPassword();
  const generated = !args.password;

  await systemAdminService.setPassword(target.id, password, { mustChange: args.mustChange });

  console.log('');
  ok('Password updated.');
  console.log(`  System Administrator ID : ${target.adminId}`);
  console.log(`  Name                    : ${target.name}`);
  console.log(`  Email                   : ${target.email ?? '(none)'}`);
  if (generated) {
    console.log(`  New password            : ${password}`);
    console.log('  (Change this password after first sign-in.)');
  }
  console.log('  Active sessions         : revoked');
}

run()
  .catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
