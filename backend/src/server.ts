import { createApp } from './app.js';
import { env } from './config/env.js';
import { ensureUploadsDir } from './config/uploads.js';
import { pool } from './database/pool.js';
import { scheduleBackgroundJobs } from './jobs/scheduler.js';
import { ensureReportsDir } from './services/report.service.js';
import { logger } from './utils/logger.js';

ensureUploadsDir();
ensureReportsDir();
const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`FarmFlow API listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  scheduleBackgroundJobs();
});

function shutdown(signal: string) {
  logger.info(`${signal} received. Shutting down gracefully.`);

  server.close(() => {
    pool
      .end()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));