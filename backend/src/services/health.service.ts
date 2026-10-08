import { pingDatabase } from '../database/pool.js';
import { env } from '../config/env.js';

export interface HealthResponse {
  status: 'ok';
  service: 'farmflow-api';
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  timezone: string;
  database: {
    status: 'up' | 'down';
    latencyMs: number | null;
    message?: string;
  };
}

export async function getHealth(): Promise<HealthResponse> {
  const database = await pingDatabase();

  return {
    status: 'ok',
    service: 'farmflow-api',
    version: '0.1.0',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    timezone: env.APP_TIMEZONE,
    database,
  };
}