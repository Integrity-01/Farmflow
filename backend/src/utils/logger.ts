import { env } from '../config/env.js';

type LogMeta = Record<string, unknown>;

const isProd = env.NODE_ENV === 'production';

function write(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: LogMeta) {
  const entry = {
    level,
    message,
    ...meta,
    timestamp: new Date().toISOString(),
  };

  if (isProd) {
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](JSON.stringify(entry));
    return;
  }

  const color =
    level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : level === 'debug' ? '\x1b[36m' : '\x1b[32m';
  const parts = [color + level.toUpperCase().padEnd(5) + '\x1b[0m', message];
  if (meta && Object.keys(meta).length > 0) {
    parts.push(JSON.stringify(meta));
  }
  // eslint-disable-next-line no-console
  console.log(parts.join(' '));
}

export const logger = {
  info: (message: string, meta?: LogMeta) => write('info', message, meta),
  warn: (message: string, meta?: LogMeta) => write('warn', message, meta),
  error: (message: string, meta?: LogMeta) => write('error', message, meta),
  debug: (message: string, meta?: LogMeta) => write('debug', message, meta),
};