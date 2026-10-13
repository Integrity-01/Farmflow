import { pool, uid } from '../database/pool.js';
import type { AuthUser } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { firstOccurrence, nextOccurrence, type RecurrenceFrequency, type RecurrenceRule } from '../utils/recurrence.js';
import { pushService } from './push.service.js';
import { emailService } from './email.service.js';

const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RecurringInput {
  title: string;
  description?: string | null;
  farmId: string;
  fieldId?: string | null;
  categoryId: string;
  assignedTo?: string | null;
  priority: string;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  weekdays: number[];
  dayOfMonth: number | null;
  startTimeMinutes: number;
  estimatedDurationMinutes?: number | null;
  reminderOffsetMinutes?: number | null;
  startDate: string;
  endDate?: string | null;
  active?: boolean;
}

export interface RecurringItem {
  id: string;
  title: string;
  description: string | null;
  farmId: string;
  farmName: string;
  fieldId: string | null;
  fieldName: string | null;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  assigneeUserId: string | null;
  createdBy: string | null;
  priority: string;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  weekdays: number[];
  dayOfMonth: number | null;
  startTimeMinutes: number;
  estimatedDurationMinutes: number | null;
  reminderOffsetMinutes: number | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  skipNext: boolean;
  nextRunAt: string | null;
  lastGeneratedAt: string | null;
  generatedCount: number;
  createdAt: string;
  updatedAt: string;
}

interface RecurringRow {
  id: string;
  title: string;
  description: string | null;
  farm_id: string;
  farm_name: string;
  field_id: string | null;
  field_name: string | null;
  category_id: string;
  category_name: string;
  category_icon: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  assignee_user_id: string | null;
  created_by: string | null;
  priority: string;
  frequency: RecurrenceFrequency;
  interval_count: number;
  weekdays: number[] | null;
  day_of_month: number | null;
  start_time_minutes: number;
  estimated_duration_minutes: number | null;
  reminder_offset_minutes: number | null;
  start_date: string | Date;
  end_date: string | Date | null;
  active: boolean;
  skip_next: boolean;
  next_run_at: string | null;
  last_generated_at: string | null;
  generated_count: number;
  created_at: string;
  updated_at: string;
}

function toRecurring(row: RecurringRow): RecurringItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    farmId: row.farm_id,
    farmName: row.farm_name,
    fieldId: row.field_id,
    fieldName: row.field_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    assignedTo: row.assigned_to,
    assigneeName: row.assignee_name,
    assigneeUserId: row.assignee_user_id,
    createdBy: row.created_by,
    priority: row.priority,
    frequency: row.frequency,
    intervalCount: row.interval_count,
    weekdays: row.weekdays ?? [],
    dayOfMonth: row.day_of_month,
    startTimeMinutes: row.start_time_minutes,
    estimatedDurationMinutes: row.estimated_duration_minutes,
    reminderOffsetMinutes: row.reminder_offset_minutes,
    startDate: formatDateOnly(row.start_date),
    endDate: row.end_date ? formatDateOnly(row.end_date) : null,
    active: row.active,
    skipNext: row.skip_next,
    nextRunAt: row.next_run_at,
    lastGeneratedAt: row.last_generated_at,
    generatedCount: row.generated_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `
  SELECT r.id, r.title, r.description, r.farm_id, f.name AS farm_name,
         r.field_id, fl.name AS field_name,
         r.category_id, c.name AS category_name, c.icon AS category_icon,
         r.assigned_to, a.name AS assignee_name, a.user_id AS assignee_user_id,
         r.created_by, r.priority, r.frequency, r.interval_count, r.weekdays,
         r.day_of_month, r.start_time_minutes, r.estimated_duration_minutes,
         r.reminder_offset_minutes, r.start_date, r.end_date, r.active,
         r.skip_next, r.next_run_at, r.last_generated_at, r.generated_count,
         r.created_at, r.updated_at
  FROM recurring_tasks r
  LEFT JOIN farms f ON f.id = r.farm_id
  LEFT JOIN fields fl ON fl.id = r.field_id
  LEFT JOIN task_categories c ON c.id = r.category_id
  LEFT JOIN workers a ON a.id = r.assigned_to`;

async function getRowById(id: string): Promise<RecurringRow | null> {
  if (!isUuid.test(id)) return null;
  const result = await pool.query<RecurringRow>(`${SELECT} WHERE r.id = $1`, [id]);
  return result.rows[0] ?? null;
}

function asRule(row: RecurringRow): RecurrenceRule {
  return {
    frequency: row.frequency,
    intervalCount: row.interval_count,
    weekdays: row.weekdays ?? [],
    dayOfMonth: row.day_of_month,
    startTimeMinutes: row.start_time_minutes,
    startDate: parseDateOnly(row.start_date),
    endDate: row.end_date ? parseDateOnly(row.end_date) : null,
  };
}

function formatDateOnly(value: string | Date): string {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return value;
}

function parseDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
  }
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

async function canLeadFarm(actor: AuthUser, farmId: string): Promise<boolean> {
  if (actor.role === 'organization_administrator') return true;
  const farm = await pool.query<{ manager_id: string | null }>(
    'SELECT manager_id FROM farms WHERE id = $1',
    [farmId],
  );
  if (farm.rows.length === 0) return false;
  if (farm.rows[0].manager_id === actor.id) return true;
  if (actor.role === 'supervisor') {
    const worker = await pool.query<{ id: string }>(
      'SELECT id FROM workers WHERE user_id = $1 AND farm_id = $2',
      [actor.id, farmId],
    );
    return worker.rows.length > 0;
  }
  return false;
}

async function assertPlacement(input: {
  farmId: string;
  fieldId?: string | null;
  categoryId: string;
  assignedTo?: string | null;
}) {
  const farm = await pool.query<{ id: string }>('SELECT id FROM farms WHERE id = $1', [input.farmId]);
  if (farm.rows.length === 0) {
    throw new AppError(400, 'Please choose a valid farm.', 'INVALID_REFERENCE');
  }
  if (input.fieldId) {
    const field = await pool.query<{ id: string; farm_id: string }>(
      'SELECT id, farm_id FROM fields WHERE id = $1',
      [input.fieldId],
    );
    if (field.rows.length === 0) {
      throw new AppError(400, 'Please choose a valid field.', 'INVALID_REFERENCE');
    }
    if (field.rows[0].farm_id !== input.farmId) {
      throw new AppError(400, 'That field does not belong to the chosen farm.', 'INVALID_REFERENCE');
    }
  }
  const category = await pool.query<{ id: string }>(
    'SELECT id FROM task_categories WHERE id = $1',
    [input.categoryId],
  );
  if (category.rows.length === 0) {
    throw new AppError(400, 'Please choose a valid category.', 'INVALID_REFERENCE');
  }
  if (input.assignedTo) {
    const worker = await pool.query<{ id: string; status: string }>(
      'SELECT id, status FROM workers WHERE id = $1',
      [input.assignedTo],
    );
    if (worker.rows.length === 0) {
      throw new AppError(400, 'Please choose a valid worker.', 'INVALID_REFERENCE');
    }
    if (worker.rows[0].status !== 'active') {
      throw new AppError(400, "That worker isn't active. Choose an active worker.", 'INVALID_REFERENCE');
    }
  }
}

interface TaskInstance {
  id: string;
  title: string;
  assigneeUserId: string | null;
  farmId: string;
}

async function createTaskInstance(rule: RecurringRow, occurrence: Date): Promise<TaskInstance> {
  const deadlineAt = rule.estimated_duration_minutes
    ? new Date(occurrence.getTime() + rule.estimated_duration_minutes * 60_000).toISOString()
    : null;

  const taskId = uid();
  const assignedTo = rule.assigned_to ?? null;
  const createdBy = rule.created_by ?? null;
  await pool.query(
    `INSERT INTO tasks (
       id, title, description, farm_id, field_id, category_id, assigned_to,
       assigned_by, created_by, priority, status, start_at, deadline_at,
       estimated_duration_minutes, reminder_offset_minutes, progress
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, 'todo', $10, $11, $12, $13, 0)`,
    [
      taskId,
      rule.title,
      rule.description ?? null,
      rule.farm_id,
      rule.field_id ?? null,
      rule.category_id,
      assignedTo,
      createdBy,
      rule.priority,
      occurrence.toISOString(),
      deadlineAt,
      rule.estimated_duration_minutes ?? null,
      rule.reminder_offset_minutes ?? null,
    ],
  );
  const result = await pool.query<{ id: string; title: string; assignee_user_id: string | null }>(
    `SELECT t.id, t.title, w.user_id AS assignee_user_id
     FROM tasks t
     LEFT JOIN workers w ON w.id = t.assigned_to
     WHERE t.id = $1`,
    [taskId],
  );
  const task = result.rows[0];

  await pool.query(
    'INSERT INTO task_history (task_id, user_id, action, new_value) VALUES ($1, $2, $3, $4)',
    [
      task.id,
      rule.created_by ?? null,
      'created',
      JSON.stringify({ title: task.title, farmId: rule.farm_id, recurring: true }),
    ],
  );

  if (task.assignee_user_id) {
    await pool.query(
      `INSERT INTO notifications (user_id, task_id, type, title, message)
       VALUES ($1, $2, 'task_assigned', $3, $4)
       ON CONFLICT DO NOTHING`,
      [task.assignee_user_id, task.id, 'New task assigned', `"${task.title}" was assigned to you.`],
    );
    void pushService.sendToUser(task.assignee_user_id, {
      title: 'New task assigned',
      message: `"${task.title}" was assigned to you.`,
      type: 'task_assigned',
      taskId: task.id,
    });
    void emailService.sendToUser(task.assignee_user_id, {
      type: 'task_assigned',
      taskId: task.id,
    });
  }

  return {
    id: task.id,
    title: task.title,
    assigneeUserId: task.assignee_user_id,
    farmId: rule.farm_id,
  };
}

const MAX_MISSED_MS = 30 * 24 * 60 * 60 * 1000;

export const recurringService = {
  async list(): Promise<RecurringItem[]> {
    const result = await pool.query<RecurringRow>(
      `${SELECT} ORDER BY r.active DESC, (r.next_run_at IS NULL) ASC, r.next_run_at ASC, r.title ASC`,
    );
    return result.rows.map(toRecurring);
  },

  async get(actor: AuthUser, id: string): Promise<RecurringItem> {
    const row = await getRowById(id);
    if (!row) throw new AppError(404, 'Recurring task not found.', 'NOT_FOUND');
    if (!(await canLeadFarm(actor, row.farm_id))) {
      throw new AppError(403, "You can only manage recurring tasks on farms you run.", 'FORBIDDEN');
    }
    return toRecurring(row);
  },

  async create(actor: AuthUser, input: RecurringInput): Promise<RecurringItem> {
    await assertPlacement(input);
    if (!(await canLeadFarm(actor, input.farmId))) {
      throw new AppError(403, "You can only create recurring tasks on farms you run.", 'FORBIDDEN');
    }

    const ruleRule: RecurrenceRule = {
      frequency: input.frequency,
      intervalCount: input.intervalCount,
      weekdays: input.weekdays ?? [],
      dayOfMonth: input.dayOfMonth ?? null,
      startTimeMinutes: input.startTimeMinutes,
      startDate: parseDateOnly(input.startDate),
      endDate: input.endDate ? parseDateOnly(input.endDate) : null,
    };
    const first = firstOccurrence(ruleRule);
    const active = input.active && first !== null;

    const id = uid();
    await pool.query(
      `INSERT INTO recurring_tasks (
         id, title, description, farm_id, field_id, category_id, assigned_to,
         created_by, priority, frequency, interval_count, weekdays, day_of_month,
         start_time_minutes, estimated_duration_minutes, reminder_offset_minutes,
         start_date, end_date, active, next_run_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        id,
        input.title.trim(),
        input.description ?? null,
        input.farmId,
        input.fieldId ?? null,
        input.categoryId,
        input.assignedTo ?? null,
        actor.id,
        input.priority,
        input.frequency,
        input.intervalCount,
        JSON.stringify((input.weekdays ?? []).length > 0 ? input.weekdays ?? [] : []),
        input.frequency === 'monthly' ? input.dayOfMonth ?? null : null,
        input.startTimeMinutes,
        input.estimatedDurationMinutes ?? null,
        input.reminderOffsetMinutes ?? null,
        input.startDate,
        input.endDate ?? null,
        active ? 1 : 0,
        first ? first.toISOString() : null,
      ],
    );

    const joined = await getRowById(id);
    logger.info(`Recurring task created`, { recurringId: id, frequency: input.frequency });
    return toRecurring(joined!);
  },

  async update(actor: AuthUser, id: string, input: Partial<RecurringInput>): Promise<RecurringItem> {
    const existing = await getRowById(id);
    if (!existing) throw new AppError(404, 'Recurring task not found.', 'NOT_FOUND');
    if (!(await canLeadFarm(actor, existing.farm_id))) {
      throw new AppError(403, "You can only manage recurring tasks on farms you run.", 'FORBIDDEN');
    }

    const merged = {
      title: input.title ?? existing.title,
      farmId: input.farmId ?? existing.farm_id,
      fieldId: input.fieldId !== undefined ? input.fieldId : existing.field_id,
      categoryId: input.categoryId ?? existing.category_id,
      assignedTo: input.assignedTo !== undefined ? input.assignedTo : existing.assigned_to,
      frequency: input.frequency ?? existing.frequency,
      intervalCount: input.intervalCount ?? existing.interval_count,
      weekdays: input.weekdays !== undefined ? input.weekdays : (existing.weekdays ?? []),
      dayOfMonth: input.dayOfMonth !== undefined ? input.dayOfMonth : existing.day_of_month,
      startTimeMinutes: input.startTimeMinutes ?? existing.start_time_minutes,
      startDate: input.startDate ?? existing.start_date,
      endDate: input.endDate !== undefined ? input.endDate : existing.end_date,
    };
    await assertPlacement(merged);

    if (input.farmId && input.farmId !== existing.farm_id) {
      if (!(await canLeadFarm(actor, input.farmId))) {
        throw new AppError(403, "You can only create recurring tasks on farms you run.", 'FORBIDDEN');
      }
    }

    const rebase = input.startDate && input.startDate !== existing.start_date;
    const afterAnchor = rebase
      ? parseDateOnly(merged.startDate)
      : existing.last_generated_at
        ? new Date(existing.last_generated_at)
        : parseDateOnly(existing.start_date);

    let nextRunAt: Date | null;
    if (rebase) {
      const ruleRule: RecurrenceRule = {
        frequency: merged.frequency,
        intervalCount: merged.intervalCount,
        weekdays: merged.weekdays,
        dayOfMonth: merged.dayOfMonth,
        startTimeMinutes: merged.startTimeMinutes,
        startDate: parseDateOnly(merged.startDate),
        endDate: merged.endDate ? parseDateOnly(merged.endDate) : null,
      };
      nextRunAt = firstOccurrence(ruleRule);
    } else {
      const ruleRule: RecurrenceRule = {
        frequency: merged.frequency,
        intervalCount: merged.intervalCount,
        weekdays: merged.weekdays,
        dayOfMonth: merged.dayOfMonth,
        startTimeMinutes: merged.startTimeMinutes,
        startDate: parseDateOnly(merged.startDate),
        endDate: merged.endDate ? parseDateOnly(merged.endDate) : null,
      };
      const from = afterAnchor.getTime() > 0 ? afterAnchor : parseDateOnly(merged.startDate);
      nextRunAt = nextOccurrence(ruleRule, from);
    }

    const active = input.active !== undefined ? input.active : existing.active;
    const finalActive = active && nextRunAt !== null;

    await pool.query(
      `UPDATE recurring_tasks SET
         title = $1, description = $2, farm_id = $3, field_id = $4, category_id = $5,
         assigned_to = $6, priority = $7, frequency = $8, interval_count = $9,
         weekdays = $10, day_of_month = $11, start_time_minutes = $12,
         estimated_duration_minutes = $13, reminder_offset_minutes = $14,
         start_date = $15, end_date = $16, active = $17,
         next_run_at = $18,
         last_generated_at = CASE WHEN $19 THEN NULL ELSE last_generated_at END,
         skip_next = CASE WHEN $19 THEN false ELSE skip_next END,
         updated_at = now()
       WHERE id = $20`,
      [
        merged.title.trim(),
        input.description !== undefined ? (input.description ?? null) : existing.description,
        merged.farmId,
        merged.fieldId ?? null,
        merged.categoryId,
        merged.assignedTo ?? null,
        input.priority ?? existing.priority,
        merged.frequency,
        merged.intervalCount,
        merged.weekdays.length > 0 ? JSON.stringify(merged.weekdays) : null,
        merged.frequency === 'monthly' ? merged.dayOfMonth ?? null : null,
        merged.startTimeMinutes,
        input.estimatedDurationMinutes !== undefined
          ? input.estimatedDurationMinutes ?? null
          : existing.estimated_duration_minutes,
        input.reminderOffsetMinutes !== undefined
          ? input.reminderOffsetMinutes ?? null
          : existing.reminder_offset_minutes,
        merged.startDate,
        merged.endDate ?? null,
        finalActive ? 1 : 0,
        nextRunAt ? nextRunAt.toISOString() : null,
        rebase,
        id,
      ],
    );

    const joined = await getRowById(id);
    return toRecurring(joined!);
  },

  async remove(actor: AuthUser, id: string): Promise<void> {
    const row = await getRowById(id);
    if (!row) throw new AppError(404, 'Recurring task not found.', 'NOT_FOUND');
    if (!(await canLeadFarm(actor, row.farm_id))) {
      throw new AppError(403, "You can only manage recurring tasks on farms you run.", 'FORBIDDEN');
    }
    await pool.query('DELETE FROM recurring_tasks WHERE id = $1', [id]);
  },

  async setActive(actor: AuthUser, id: string, active: boolean): Promise<RecurringItem> {
    const row = await getRowById(id);
    if (!row) throw new AppError(404, 'Recurring task not found.', 'NOT_FOUND');
    if (!(await canLeadFarm(actor, row.farm_id))) {
      throw new AppError(403, "You can only manage recurring tasks on farms you run.", 'FORBIDDEN');
    }
    if (active && !row.next_run_at) {
      const rule = asRule(row);
      const next = firstOccurrence(rule);
      await pool.query(
        `UPDATE recurring_tasks SET active = $1, next_run_at = $2, updated_at = now() WHERE id = $3`,
        [active ? 1 : 0, next ? next.toISOString() : null, id],
      );
    } else {
      await pool.query(
        `UPDATE recurring_tasks SET active = $1, updated_at = now() WHERE id = $2`,
        [active ? 1 : 0, id],
      );
    }
    const joined = await getRowById(id);
    return toRecurring(joined!);
  },

  async skipNext(actor: AuthUser, id: string): Promise<RecurringItem> {
    const row = await getRowById(id);
    if (!row) throw new AppError(404, 'Recurring task not found.', 'NOT_FOUND');
    if (!(await canLeadFarm(actor, row.farm_id))) {
      throw new AppError(403, "You can only manage recurring tasks on farms you run.", 'FORBIDDEN');
    }
    if (!row.active) throw new AppError(409, 'This recurring task is paused.', 'RULE_INACTIVE');
    await pool.query(
      `UPDATE recurring_tasks SET skip_next = true, updated_at = now() WHERE id = $1`,
      [id],
    );
    const joined = await getRowById(id);
    return toRecurring(joined!);
  },

  async generateNow(actor: AuthUser, id: string): Promise<{ rule: RecurringItem; task: TaskInstance | null; skipped: boolean }> {
    const row = await getRowById(id);
    if (!row) throw new AppError(404, 'Recurring task not found.', 'NOT_FOUND');
    if (!(await canLeadFarm(actor, row.farm_id))) {
      throw new AppError(403, "You can only manage recurring tasks on farms you run.", 'FORBIDDEN');
    }
    if (!row.active) throw new AppError(409, 'This recurring task is paused.', 'RULE_INACTIVE');

    const rule = asRule(row);
    const pending = row.next_run_at ? new Date(row.next_run_at) : firstOccurrence(rule);
    if (!pending) throw new AppError(409, 'This recurring task has ended.', 'RULE_ENDED');

    let task: TaskInstance | null = null;
    const nextAfter = nextOccurrence(rule, pending);

    if (row.skip_next) {
      await pool.query(
        `UPDATE recurring_tasks SET skip_next = false, next_run_at = $1, last_generated_at = $2,
                active = $3, updated_at = now()
         WHERE id = $4`,
        [nextAfter ? nextAfter.toISOString() : null, pending.toISOString(), nextAfter !== null ? 1 : 0, id],
      );
      const joinedSkipped = await getRowById(id);
      return { rule: toRecurring(joinedSkipped!), task: null, skipped: true };
    }

    task = await createTaskInstance(row, pending);
    await pool.query(
      `UPDATE recurring_tasks SET
         next_run_at = $1, last_generated_at = $2, generated_count = $3,
         active = $4, updated_at = now()
       WHERE id = $5`,
      [nextAfter ? nextAfter.toISOString() : null, pending.toISOString(), row.generated_count + 1, nextAfter !== null ? 1 : 0, id],
    );
    const joined = await getRowById(id);
    logger.info('Recurring task generated', { recurringId: id, taskId: task.id });
    return { rule: toRecurring(joined!), task, skipped: false };
  },

  async processDue(): Promise<number> {
    const result = await pool.query<RecurringRow>(
      `SELECT * FROM recurring_tasks
       WHERE active = true
         AND (next_run_at <= now() OR (next_run_at IS NULL AND start_date <= now()))`,
    );

    let generated = 0;
    for (const row of result.rows) {
      const rule = asRule(row);
      const pending = row.next_run_at ? new Date(row.next_run_at) : firstOccurrence(rule);
      if (!pending) {
        await pool.query(
          `UPDATE recurring_tasks SET active = false, next_run_at = NULL WHERE id = $1`,
          [row.id],
        );
        continue;
      }

      const nextAfter = nextOccurrence(rule, pending);

      if (row.skip_next) {
        await pool.query(
          `UPDATE recurring_tasks SET skip_next = false, next_run_at = $1,
                  last_generated_at = $2, active = $3, updated_at = now()
           WHERE id = $4`,
          [nextAfter ? nextAfter.toISOString() : null, pending.toISOString(), nextAfter !== null, row.id],
        );
        continue;
      }

      if (pending.getTime() < Date.now() - MAX_MISSED_MS) {
        await pool.query(
          `UPDATE recurring_tasks SET next_run_at = $1, last_generated_at = $2,
                  active = $3, updated_at = now()
           WHERE id = $4`,
          [nextAfter ? nextAfter.toISOString() : null, pending.toISOString(), nextAfter !== null, row.id],
        );
        continue;
      }

      await createTaskInstance(row, pending);
      generated += 1;
      await pool.query(
        `UPDATE recurring_tasks SET next_run_at = $1, last_generated_at = $2,
                generated_count = $3, active = $4, updated_at = now()
         WHERE id = $5`,
        [nextAfter ? nextAfter.toISOString() : null, pending.toISOString(), row.generated_count + 1, nextAfter !== null, row.id],
      );
    }

    if (generated > 0) {
      logger.info('Recurring tasks generated', { count: generated });
    }
    return generated;
  },
};