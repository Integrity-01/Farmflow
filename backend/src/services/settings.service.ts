import bcrypt from 'bcryptjs';
import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { authService, authSession } from './auth.service.js';
import type { AuthUser } from '../types/auth.js';

export interface NotificationPrefs {
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  taskAssignments: boolean;
  deadlineReminders: boolean;
  overdueAlerts: boolean;
  taskCompletions: boolean;
  dailySummary: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  emailEnabled: true,
  pushEnabled: true,
  inAppEnabled: true,
  taskAssignments: true,
  deadlineReminders: true,
  overdueAlerts: true,
  taskCompletions: true,
  dailySummary: false,
};

interface PrefsRow {
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  task_assignments: boolean;
  deadline_reminders: boolean;
  overdue_alerts: boolean;
  task_completions: boolean;
  daily_summary: boolean;
}

function toPrefs(row: PrefsRow): NotificationPrefs {
  return {
    emailEnabled: row.email_enabled,
    pushEnabled: row.push_enabled,
    inAppEnabled: row.in_app_enabled,
    taskAssignments: row.task_assignments,
    deadlineReminders: row.deadline_reminders,
    overdueAlerts: row.overdue_alerts,
    taskCompletions: row.task_completions,
    dailySummary: row.daily_summary,
  };
}

export const settingsService = {
  async getProfile(userId: string): Promise<AuthUser> {
    return authService.me(userId);
  },

  async updateProfile(userId: string, input: { name: string; phone?: string | null }): Promise<AuthUser> {
    const trimmedName = input.name.trim();
    const trimmedPhone = input.phone?.trim() || null;
    const result = await pool.query(
      `UPDATE users SET name = $1, phone = $2, updated_at = now()
       WHERE id = $3`,
      [trimmedName, trimmedPhone, userId],
    );
    if (result.rowCount === 0) {
      throw new AppError(404, "We couldn't find your account.", 'NOT_FOUND');
    }
    const updated = await pool.query<{
      id: string; name: string; email: string; phone: string | null; role: string; avatar_url: string | null;
    }>(
      `SELECT id, name, email, phone, role, avatar_url
       FROM users WHERE id = $1`,
      [userId],
    );
    const row = updated.rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role as AuthUser['role'],
      avatarUrl: row.avatar_url,
    };
  },

  async getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
    const result = await pool.query<PrefsRow>(
      `SELECT email_enabled, push_enabled, in_app_enabled,
              task_assignments, deadline_reminders, overdue_alerts,
              task_completions, daily_summary
       FROM notification_preferences WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0] ? toPrefs(result.rows[0]) : DEFAULT_PREFS;
  },

  async updateNotificationPrefs(
    userId: string,
    input: Partial<NotificationPrefs>,
  ): Promise<NotificationPrefs> {
    await pool.query(
      `INSERT IGNORE INTO notification_preferences (user_id)
       VALUES ($1)`,
      [userId],
    );
    const assignments = Object.entries(input) as [keyof NotificationPrefs, boolean][];
    const allowed = new Set([
      'emailEnabled', 'pushEnabled', 'inAppEnabled',
      'taskAssignments', 'deadlineReminders', 'overdueAlerts', 'taskCompletions', 'dailySummary',
    ]);
    const columnMap: Record<keyof NotificationPrefs, string> = {
      emailEnabled: 'email_enabled',
      pushEnabled: 'push_enabled',
      inAppEnabled: 'in_app_enabled',
      taskAssignments: 'task_assignments',
      deadlineReminders: 'deadline_reminders',
      overdueAlerts: 'overdue_alerts',
      taskCompletions: 'task_completions',
      dailySummary: 'daily_summary',
    };

    if (assignments.some(([key]) => !allowed.has(key))) {
      throw new AppError(400, 'Please send valid notification preferences.', 'VALIDATION_ERROR');
    }

    if (assignments.length > 0) {
      const sets = assignments
        .map(([key], index) => `${columnMap[key]} = $${index + 2}`)
        .join(', ');
      const values = [userId, ...assignments.map(([, value]) => value)];
      await pool.query(
        `UPDATE notification_preferences SET ${sets}, updated_at = now() WHERE user_id = $1`,
        values,
      );
    }

    return settingsService.getNotificationPrefs(userId);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const result = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1 AND is_active = true',
      [userId],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw new AppError(400, 'Your current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.withTransaction(async (db) => {
      await db.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [passwordHash, userId]);
      await authSession.revokeAllForUser(userId, db);
    });
  },
};