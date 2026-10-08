import { createTransport, type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import { env } from '../config/env.js';
import { pool } from '../database/pool.js';
import { logger } from '../utils/logger.js';
import { emailTemplates, type DailySummaryContext, type TaskEmailContext } from './email/templates.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transport: Transporter | null = null;

function hasSmtpConfig(): boolean {
  return Boolean(env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASS);
}

function getTransport(): Transporter | null {
  if (env.EMAIL_PROVIDER !== 'smtp' || !hasSmtpConfig()) {
    return null;
  }

  if (!transport) {
    transport = createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT ?? 587,
      secure: env.EMAIL_SECURE,
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS },
    } as SMTPTransport.Options);
  }

  return transport;
}

/**
 * Sends an email through the configured provider.
 *
 * When SMTP details are empty (local development), the email is written to the
 * log instead of being delivered. Returns whether the email was handed to a
 * real transport.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const activeTransport = getTransport();

  if (!activeTransport) {
    logger.warn(`[email:${env.EMAIL_PROVIDER}] Email not sent (no provider configured).`, {
      to: options.to,
      subject: options.subject,
    });
    logger.debug(`[email:${env.EMAIL_PROVIDER}] Body preview`, {
      html: options.html.slice(0, 500),
    });
    return false;
  }

  try {
    await activeTransport.sendMail({
      from: env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return true;
  } catch (error) {
    logger.error('Failed to send email.', {
      to: options.to,
      subject: options.subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export function providerConfigured(): boolean {
  return env.EMAIL_PROVIDER === 'smtp' && hasSmtpConfig();
}

interface EmailPrefsRow {
  email_enabled: boolean;
  task_assignments: boolean;
  deadline_reminders: boolean;
  overdue_alerts: boolean;
  task_completions: boolean;
  daily_summary: boolean;
}

const TYPE_PREF: Record<string, keyof EmailPrefsRow | undefined> = {
  task_assigned: 'task_assignments',
  task_due_soon: 'deadline_reminders',
  task_overdue: 'overdue_alerts',
  task_completed: 'task_completions',
  daily_summary: 'daily_summary',
};

export interface EmailSendInput {
  type: 'task_assigned' | 'task_due_soon' | 'task_overdue' | 'task_completed' | 'task_comment';
  taskId: string;
  senderName?: string | null;
}

function dueLabel(deadlineAt: Date | null): string {
  if (!deadlineAt) return 'no deadline';
  return deadlineAt.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface TaskContextRow {
  id: string;
  title: string;
  farm_name: string;
  deadline_at: Date | null;
  description: string | null;
}

async function loadTaskContext(taskId: string): Promise<TaskContextRow | null> {
  const result = await pool.query<TaskContextRow>(
    `SELECT t.id, t.title, f.name AS farm_name, t.deadline_at, t.description
     FROM tasks t LEFT JOIN farms f ON f.id = t.farm_id
     WHERE t.id = $1`,
    [taskId],
  );
  return result.rows[0] ?? null;
}

async function buildTaskEmail(input: EmailSendInput, name: string): Promise<{ subject: string; html: string } | null> {
  const task = await loadTaskContext(input.taskId);
  if (!task) return null;
  const context: TaskEmailContext = {
    taskId: task.id,
    taskTitle: task.title,
    dueLabel: dueLabel(task.deadline_at),
    farmName: task.farm_name ?? 'Unknown farm',
    notes: task.description ?? '',
  };

  switch (input.type) {
    case 'task_assigned':
      return emailTemplates.taskAssigned(name, context);
    case 'task_due_soon':
      return emailTemplates.taskDueSoon(name, context);
    case 'task_overdue':
      return emailTemplates.taskOverdue(name, context);
    case 'task_completed':
      return emailTemplates.taskCompleted(name, context);
    case 'task_comment':
      return emailTemplates.taskComment(name, context, input.senderName ?? 'Someone');
  }
}

/**
 * Sends a notification email for task events, gated by the user's
 * `emailEnabled` and per-type preferences (the same toggles as web push).
 * Fire-and-forget: it never throws, and without an SMTP provider it logs
 * instead of delivering.
 */
export const emailService = {
  async sendToUser(userId: string, input: EmailSendInput): Promise<void> {
    let prefs: EmailPrefsRow;
    let recipient: { name: string; email: string } | null = null;
    try {
      const result = await pool.query<EmailPrefsRow & { name: string; email: string }>(
        `SELECT np.email_enabled, np.task_assignments, np.deadline_reminders,
                np.overdue_alerts, np.task_completions, np.daily_summary,
                u.name, u.email
         FROM notification_preferences np
         JOIN users u ON u.id = np.user_id
         WHERE np.user_id = $1`,
        [userId],
      );
      if (result.rows.length === 0) return;
      prefs = result.rows[0];
      recipient = { name: result.rows[0].name, email: result.rows[0].email };
    } catch (error) {
      logger.error('[email] Could not load recipient', { message: (error as Error).message, userId });
      return;
    }

    if (!prefs.email_enabled) return;

    const prefKey = TYPE_PREF[input.type];
    if (prefKey && !prefs[prefKey]) return;

    if (!recipient.email) return;

    const built = await buildTaskEmail(input, recipient.name);
    if (!built) return;

    void sendEmail({
      to: recipient.email,
      subject: built.subject,
      html: built.html,
    }).then((delivered) => {
      if (delivered) logger.debug('[email] Sent', { to: recipient.email, type: input.type, taskId: input.taskId });
    });
  },

  async sendDailySummary(userId: string, ctx: Omit<DailySummaryContext, 'name'>): Promise<void> {
    try {
      const result = await pool.query<EmailPrefsRow & { name: string; email: string }>(
        `SELECT np.email_enabled, np.task_assignments, np.deadline_reminders,
                np.overdue_alerts, np.task_completions, np.daily_summary,
                u.name, u.email
         FROM notification_preferences np
         JOIN users u ON u.id = np.user_id
         WHERE np.user_id = $1`,
        [userId],
      );
      if (result.rows.length === 0) return;
      const prefs = result.rows[0];
      if (!prefs.email_enabled || !prefs.daily_summary || !prefs.email) return;
      const tpl = emailTemplates.dailySummary(prefs.name, { ...ctx, name: prefs.name });
      await sendEmail({ to: prefs.email, subject: tpl.subject, html: tpl.html });
    } catch (error) {
      logger.error('[email] Daily summary failed', { message: (error as Error).message, userId });
    }
  },
};