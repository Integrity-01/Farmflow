// Production web build wrapper.
//
// Root .env sets NODE_ENV=development (the backend needs it for dev limits /
// log mode). Vite loads that same .env while building, which would ship
// development React (jsxDEV transforms, dev-only routes, extra weight) in the
// production bundle. Setting process.env.NODE_ENV before Vite is even loaded
// — the same way a shell env var does — is the only lever that wins, because
// dotenv never overrides an already-set value. In-config assignments and
// --mode are both applied too late to matter.
process.env.NODE_ENV = 'production';

const { build } = await import('vite');

try {
  await build();
} catch (error) {
  console.error(error);
  process.exit(1);
}
