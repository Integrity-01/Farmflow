import cron from 'node-cron';
import { pool } from '../database/pool.js';
import { logger } from '../utils/logger.js';
import { pushService } from '../services/push.service.js';
import { emailService } from '../services/email.service.js';
import { whatsappService } from '../services/whatsapp.service.js';
import { recurringService } from '../services/recurring.service.js';

interface DayBounds {
  startOfDay: Date;
  endOfDay: Date;
}

function todayBoundsInTimezone(now: Date, timezone: string): DayBounds {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '0';
  const year = Number(get('year'));
  const month = Number(get('month')) - 1;
  const day = Number(get('day'));
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  const second = Number(get('second'));
  const localAsUtc = Date.UTC(year, month, day, hour, minute, second);
  const partsMs = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const offsetMatch = /([+-])(\d{2}):?(\d{2})/.exec(partsMs);
  const offsetMinutes = offsetMatch
    ? (offsetMatch[1] === '-' ? -1 : 1) * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]))
    : 0;
  const utcNowMs = localAsUtc - offsetMinutes * 60_000;
  const startOfDay = new Date(utcNowMs - (hour * 3600 + minute * 60 + second) * 1000);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  return { startOfDay, endOfDay };
}

async function run(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    logger.error(`Scheduled job "${name}" failed`, { message: (error as Error).message });
  }
}

function insertNotifications(
  rows: { userId: string; taskId: string; type: 'task_overdue' | 'task_due_soon'; title: string; message: string }[],
) {
  for (const row of rows) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    pool
      .query(
        `INSERT INTO notifications (user_id, task_id, type, title, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [row.userId, row.taskId, row.type, row.title, row.message],
      )
      .catch(() => undefined);
    // Fire-and-forget web push; delivery failures are handled inside.
    void pushService.sendToUser(row.userId, {
      title: row.title,
      message: row.message,
      type: row.type,
      taskId: row.taskId,
    });
    // Fire-and-forget notification email; gated on SMTP + user preferences.
    void emailService.sendToUser(row.userId, { type: row.type, taskId: row.taskId });
    // Fire-and-forget WhatsApp reminder; gated on linked number + preferences.
    void whatsappService.sendToUser(row.userId, {
      title: row.title,
      message: row.message,
      type: row.type,
      taskId: row.taskId,
    });
  }
}

async function checkOverdueTasks() {
  const result = await pool.query<{ id: string; title: string; assigned_by: string | null; assignee_user_id: string | null }>(
    `SELECT t.id, t.title, t.assigned_by, w.user_id AS assignee_user_id
     FROM tasks t
     LEFT JOIN workers w ON w.id = t.assigned_to
     WHERE t.status <> 'finished'
       AND t.deadline_at IS NOT NULL
       AND t.deadline_at < now()
       AND t.overdue_notified_at IS NULL`,
  );

  if (result.rows.length === 0) return;

  const notified: { userId: string; taskId: string; type: 'task_overdue'; title: string; message: string }[] = [];
  for (const task of result.rows) {
    const targets = new Set<string>();
    if (task.assignee_user_id) targets.add(task.assignee_user_id);
    if (task.assigned_by) targets.add(task.assigned_by);
    for (const userId of targets) {
      notified.push({
        userId,
        taskId: task.id,
        type: 'task_overdue',
        title: 'Task overdue',
        message: `"${task.title}" is overdue.`,
      });
    }
  }

  insertNotifications(notified);
  const ids = result.rows.map((task) => task.id);
  await pool.query(
    `UPDATE tasks SET overdue_notified_at = now()
     WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  logger.info(`Overdue notifications queued`, { count: result.rows.length });
}

async function checkDueSoonReminders() {
  const result = await pool.query<{ id: string; title: string; assigned_by: string | null; assignee_user_id: string | null }>(
    `SELECT t.id, t.title, t.assigned_by, w.user_id AS assignee_user_id
     FROM tasks t
     LEFT JOIN workers w ON w.id = t.assigned_to
     WHERE t.status <> 'finished'
       AND t.deadline_at IS NOT NULL
       AND t.reminder_sent_at IS NULL
       AND t.deadline_at > now()
       AND t.deadline_at <= now() + INTERVAL 1 HOUR`,
  );

  if (result.rows.length === 0) return;

  const notified: { userId: string; taskId: string; type: 'task_due_soon'; title: string; message: string }[] = [];
  for (const task of result.rows) {
    const targets = new Set<string>();
    if (task.assignee_user_id) targets.add(task.assignee_user_id);
    if (task.assigned_by) targets.add(task.assigned_by);
    for (const userId of targets) {
      notified.push({
        userId,
        taskId: task.id,
        type: 'task_due_soon',
        title: 'Due soon',
        message: `"${task.title}" is due within the next hour.`,
      });
    }
  }

  insertNotifications(notified);
  const ids = result.rows.map((task) => task.id);
  await pool.query(
    `UPDATE tasks SET reminder_sent_at = now()
     WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  logger.info(`Due-soon reminders queued`, { count: result.rows.length });
}

async function processRecurringTasks() {
  await recurringService.processDue();
}

async function cleanExpiredAuthTokens() {
  await pool.query('DELETE FROM sessions WHERE expires_at < now()');
  await pool.query('DELETE FROM password_reset_tokens WHERE expires_at < now()');
}

interface SummaryTaskRow {
  title: string;
  status: 'todo' | 'in_progress' | 'finished';
  deadline_at: Date | null;
  finished_today: boolean;
  due_today: boolean;
  overdue: boolean;
  attention: boolean;
}

async function sendDailySummaries() {
  const users = await pool.query<{ user_id: string }>(
    `SELECT user_id
     FROM notification_preferences
     WHERE daily_summary = TRUE`,
  );
  if (users.rows.length === 0) return;

  const timezone = process.env.APP_TIMEZONE ?? 'UTC';
  const now = new Date();
  const { startOfDay, endOfDay } = todayBoundsInTimezone(now, timezone);

  for (const row of users.rows) {
    const userId = row.user_id;
    try {
      const tasks = await pool.query<SummaryTaskRow>(
        `SELECT t.title, t.status, t.deadline_at,
                (t.completed_at IS NOT NULL AND t.status = 'finished'
                 AND t.completed_at >= $2 AND t.completed_at < $3) AS finished_today,
                (t.deadline_at IS NOT NULL AND t.status <> 'finished'
                 AND t.deadline_at >= $2 AND t.deadline_at < $3) AS due_today,
                (t.deadline_at IS NOT NULL AND t.status <> 'finished' AND t.deadline_at < now()) AS overdue,
                (t.deadline_at IS NOT NULL AND t.status <> 'finished'
                 AND (t.deadline_at < now() OR t.deadline_at <= now() + INTERVAL 1 DAY)) AS attention
         FROM tasks t
         LEFT JOIN workers w ON w.id = t.assigned_to
         WHERE (w.user_id = $1 OR t.assigned_by = $1)
           AND t.created_at >= now() - INTERVAL 7 DAY`,
        [userId, startOfDay, endOfDay],
      );

      const total = tasks.rows.length;
      const completed = tasks.rows.filter((task) => task.finished_today).length;
      const overdue = tasks.rows.filter((task) => task.overdue).length;
      const dueToday = tasks.rows.filter((task) => task.due_today).length;
      const attention = tasks.rows
        .filter((task) => task.attention)
        .slice(0, 8)
        .map((task) => ({
          title: task.title,
          dueLabel: task.deadline_at
            ? task.deadline_at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : 'no deadline',
          status: task.status.replace('_', ' '),
        }));

      const message = `${completed}/${total} done · ${dueToday} due today · ${overdue} overdue`;
      void pushService.sendToUser(userId, {
        title: 'Your daily FarmFlow summary',
        message,
        type: 'daily_summary',
        taskId: null,
      });
      void whatsappService.sendToUser(userId, {
        title: 'Your daily FarmFlow summary',
        message,
        type: 'daily_summary',
        taskId: null,
      });
      await emailService.sendDailySummary(userId, { total, completed, dueToday, overdue, items: attention });
    } catch (error) {
      logger.error(`Daily summary failed for user`, { userId, message: (error as Error).message });
    }
  }
  logger.info(`Daily summaries sent`, { count: users.rows.length });
}

export function scheduleBackgroundJobs() {
  cron.schedule('*/15 * * * *', () => void run('check-overdue-tasks', checkOverdueTasks));
  cron.schedule('*/5 * * * *', () => void run('check-due-soon', checkDueSoonReminders));
  cron.schedule('*/5 * * * *', () => void run('recurring-tasks', processRecurringTasks));
  cron.schedule('30 6 * * *', () => void run('daily-summaries', sendDailySummaries));
  cron.schedule('0 3 * * *', () => void run('clean-expired-auth-tokens', cleanExpiredAuthTokens));
  logger.info('Background job scheduler started (overdue, due-soon, recurring-task and daily-summary checks).');
}