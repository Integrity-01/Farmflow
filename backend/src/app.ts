import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { UPLOADS_DIR } from './config/uploads.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { requestLogger } from './middleware/request-logger.js';
import routes from './routes/index.js';
import { REPORTS_DIR } from './services/report.service.js';

const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());

  // Compress JSON/CSV responses (the app's largest data). Level 6 balances
  // CPU with ~80% savings on typical list payloads.
  app.use(compression({ level: 6 }));

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      status: 'error',
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down and try again shortly.',
    },
  });

  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/reports', express.static(REPORTS_DIR));

  // API responses must never enter the browser HTTP cache: express ETags +
  // heuristic caching let the browser replay stale 401s to the app while the
  // real server said otherwise (and it bypasses the service worker's TTL
  // logic). Offline reads are handled by the service worker's own cache.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', requestLogger, apiLimiter);
  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}