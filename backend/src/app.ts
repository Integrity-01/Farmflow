import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
const isProduction = env.NODE_ENV === 'production';

// In development the web app is often served from a different local port
// (Vite may bump 5173 -> 5174, `vite preview` uses 4173, XAMPP uses 80, or a
// phone hits the machine's LAN IP). Those origins still proxy to this API, so
// the browser sends them as the request Origin. Allow localhost / loopback /
// private-LAN origins outside production; production stays allowlist-only.
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i;
const PRIVATE_LAN_ORIGIN_PATTERN =
  /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/i;

function isDevelopmentOrigin(origin: string): boolean {
  if (isProduction) return false;
  return LOCAL_ORIGIN_PATTERN.test(origin) || PRIVATE_LAN_ORIGIN_PATTERN.test(origin);
}

// Built web app, produced by `npm run build:web` into the repo root dist/.
// From backend/src (tsx) or backend/dist (compiled) this resolves to <repo>/dist.
const apiDir = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(apiDir, '../../dist');

const STATIC_EXEMPT_PREFIXES = ['/api', '/uploads', '/reports', '/assets'];

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
        if (!origin || allowedOrigins.includes(origin) || isDevelopmentOrigin(origin)) {
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

  // Serve the built web app from the same process when present (single-service
  // deploys); otherwise leave routing to an external static host (Nginx, VPS).
  if (existsSync(path.join(webDist, 'index.html'))) {
    app.use(
      express.static(webDist, {
        index: 'index.html',
        setHeaders(res, filePath) {
          const base = path.basename(filePath);
          if (base === 'index.html' || base === 'sw.js' || base === 'manifest.webmanifest') {
            res.setHeader('Cache-Control', 'no-store');
          } else if (filePath.startsWith(path.join(webDist, 'assets'))) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );

    app.use((req, res, next) => {
      if (req.method !== 'GET' || STATIC_EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}