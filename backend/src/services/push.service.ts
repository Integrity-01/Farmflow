import webpush from 'web-push';
import { env } from '../config/env.js';
import { pool } from '../database/pool.js';
import { logger } from '../utils/logger.js';

export interface PushSendInput {
  title: string;
  message: string;
  type: string;
  taskId: string | null;
}

interface PushPrefsRow {
  push_enabled: boolean;
  task_assignments: boolean;
  deadline_reminders: boolean;
  overdue_alerts: boolean;
  task_completions: boolean;
  daily_summary: boolean;
}

const DEFAULT_PREFS: PushPrefsRow = {
  push_enabled: true,
  task_assignments: true,
  deadline_reminders: true,
  overdue_alerts: true,
  task_completions: true,
  daily_summary: false,
};

const TYPE_PREF: Record<string, keyof PushPrefsRow> = {
  task_assigned: 'task_assignments',
  task_due_soon: 'deadline_reminders',
  task_overdue: 'overdue_alerts',
  task_completed: 'task_completions',
  daily_summary: 'daily_summary',
};

let pushConfigured = false;

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  const match = /<([^>]+)>/.exec(env.EMAIL_FROM);
  const email = match ? match[1].trim() : 'no-reply@farmflow.example';
  try {
    webpush.setVapidDetails(`mailto:${email}`, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    pushConfigured = true;
  } catch (error) {
    logger.error('[push] VAPID setup failed', { message: (error as Error).message });
  }
}

export const pushService = {
  isConfigured(): boolean {
    return pushConfigured;
  },

  getVapidPublicKey(): string | null {
    return env.VAPID_PUBLIC_KEY ?? null;
  },

  async subscribe(
    actorId: string,
    subscription: { endpoint: string; p256dh: string; auth: string },
    userAgent: string | null,
  ): Promise<{ status: 'active' }> {
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON DUPLICATE KEY UPDATE
         p256dh = VALUES(p256dh),
         auth = VALUES(auth),
         user_agent = VALUES(user_agent),
         updated_at = now()`,
      [actorId, subscription.endpoint, subscription.p256dh, subscription.auth, userAgent ?? null],
    );
    return { status: 'active' };
  },

  async unsubscribe(actorId: string, endpoint: string): Promise<{ status: 'inactive' }> {
    await pool.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [actorId, endpoint],
    );
    return { status: 'inactive' };
  },

  async sendToUser(userId: string, input: PushSendInput): Promise<void> {
    if (!pushConfigured) {
      logger.debug('[push] Skipped (VAPID not configured).', { userId, type: input.type });
      return;
    }

    let prefs: PushPrefsRow;
    try {
      const result = await pool.query<PushPrefsRow>(
        `SELECT push_enabled, task_assignments, deadline_reminders, overdue_alerts,
                task_completions, daily_summary
         FROM notification_preferences WHERE user_id = $1`,
        [userId],
      );
      prefs = result.rows[0] ?? DEFAULT_PREFS;
    } catch (error) {
      logger.error('[push] Could not load preferences', { message: (error as Error).message });
      return;
    }

    if (!prefs.push_enabled) return;

    const prefKey = TYPE_PREF[input.type];
    if (prefKey && !prefs[prefKey]) return;

    let subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[];
    try {
      const result = await pool.query(
        `SELECT id, endpoint, p256dh, auth
         FROM push_subscriptions WHERE user_id = $1`,
        [userId],
      );
      subscriptions = result.rows;
    } catch (error) {
      logger.error('[push] Could not load subscriptions', { message: (error as Error).message });
      return;
    }

    if (subscriptions.length === 0) return;

    const url = input.taskId ? `/tasks?task=${input.taskId}` : '/notifications';
    const payload = JSON.stringify({
      title: input.title,
      body: input.message,
      url,
      taskId: input.taskId,
    });

    for (const subscription of subscriptions) {
      const sendOptions = {
        TTL: 86400,
      };

      webpush
        .sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          sendOptions,
        )
        .then(() => undefined)
        .catch(async (error: { statusCode?: number; statusMessage?: string }) => {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await pool
              .query('DELETE FROM push_subscriptions WHERE id = $1', [subscription.id])
              .catch(() => undefined);
            logger.info('[push] Removed expired subscription', { endpoint: subscription.endpoint });
            return;
          }
          logger.warn('[push] Delivery failed', {
            endpoint: subscription.endpoint,
            status: error.statusCode ?? 'network',
          });
        });
    }
  },
};