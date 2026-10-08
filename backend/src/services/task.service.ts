import fs from 'node:fs/promises';
import path from 'node:path';
import { pool, uid } from '../database/pool.js';
import type { AuthUser, UserRole } from '../types/auth.js';
import { roleAtLeast } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { UPLOADS_DIR } from '../config/uploads.js';
import { pushService } from './push.service.js';
import { emailService } from './email.service.js';

export interface TaskItem {
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
  assignedBy: string | null;
  createdBy: string | null;
  createdByName: string | null;
  priority: string;
  status: string;
  startAt: string | null;
  deadlineAt: string | null;
  estimatedDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  progress: number;
  reminderOffsetMinutes: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCommentItem {
  id: string;
  taskId: string;
  userId: string | null;
  userName: string | null;
  body: string;
  createdAt: string;
}

export interface TaskAttachmentItem {
  id: string;
  taskId: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  createdAt: string;
}

export interface TaskDetail extends TaskItem {
  comments: TaskCommentItem[];
  attachments: TaskAttachmentItem[];
}

interface TaskRow {
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
  assigned_by: string | null;
  created_by: string | null;
  created_by_name: string | null;
  priority: string;
  status: string;
  start_at: string | null;
  deadline_at: string | null;
  estimated_duration_minutes: number | null;
  actual_duration_minutes: number | null;
  progress: number;
  reminder_offset_minutes: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CommentRow {
  id: string;
  task_id: string;
  user_id: string | null;
  user_name: string | null;
  body: string;
  created_at: string;
}

interface AttachmentRow {
  id: string;
  task_id: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  url: string;
  created_at: string;
}

const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TASK_SELECT = `
  SELECT t.id, t.title, t.description, t.farm_id, f.name AS farm_name,
         t.field_id, fl.name AS field_name,
         t.category_id, c.name AS category_name, c.icon AS category_icon,
         t.assigned_to, a.name AS assignee_name, a.user_id AS assignee_user_id,
         t.assigned_by, t.created_by, cu.name AS created_by_name,
         t.priority, t.status, t.start_at, t.deadline_at,
         t.estimated_duration_minutes, t.actual_duration_minutes, t.progress,
         t.reminder_offset_minutes, t.completed_at, t.created_at, t.updated_at
  FROM tasks t
  LEFT JOIN farms f ON f.id = t.farm_id
  LEFT JOIN fields fl ON fl.id = t.field_id
  LEFT JOIN task_categories c ON c.id = t.category_id
  LEFT JOIN workers a ON a.id = t.assigned_to
  LEFT JOIN users cu ON cu.id = t.created_by
`;

const COMMENT_SELECT = `
  SELECT tc.id, tc.task_id, tc.user_id, u.name AS user_name, tc.body, tc.created_at
  FROM task_comments tc
  LEFT JOIN users u ON u.id = tc.user_id
`;

const ATTACHMENT_SELECT = `
  SELECT ta.id, ta.task_id, ta.uploaded_by, u.name AS uploaded_by_name,
         ta.file_name, ta.file_type, ta.file_size, ta.url, ta.created_at
  FROM task_attachments ta
  LEFT JOIN users u ON u.id = ta.uploaded_by
`;

function toTask(row: TaskRow): TaskItem {
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
    assignedBy: row.assigned_by,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    priority: row.priority,
    status: row.status,
    startAt: row.start_at,
    deadlineAt: row.deadline_at,
    estimatedDurationMinutes: row.estimated_duration_minutes,
    actualDurationMinutes: row.actual_duration_minutes,
    progress: row.progress,
    reminderOffsetMinutes: row.reminder_offset_minutes,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function visibleScope(role: UserRole): string {
  if (roleAtLeast(role, 'farm_manager')) return '';
  if (role === 'supervisor') {
    return `t.farm_id IN (
      SELECT farm_id FROM farms WHERE manager_id = $scope
      UNION
      SELECT farm_id FROM workers WHERE user_id = $scope)`;
  }
  return `t.assigned_to = (SELECT id FROM workers WHERE user_id = $scope)`;
}

function ownScope(actor: AuthUser): string {
  return visibleScope(actor.role).replace(/\$scope/g, `'${actor.id}'`);
}

async function canLeadFarm(actor: AuthUser, farmId: string): Promise<boolean> {
  if (actor.role === 'administrator') return true;
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

async function assertFarmFieldCategoryPlacement(input: {
  farmId: string;
  fieldId?: string | null;
  categoryId: string;
}) {
  const farm = await pool.query<{ id: string; status: string }>(
    'SELECT id, status FROM farms WHERE id = $1',
    [input.farmId],
  );
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
}

async function assertAssignee(assignedTo?: string | null) {
  if (!assignedTo) return;
  const worker = await pool.query<{ id: string; user_id: string | null; status: string }>(
    'SELECT id, user_id, status FROM workers WHERE id = $1',
    [assignedTo],
  );
  if (worker.rows.length === 0) {
    throw new AppError(400, 'Please choose a valid worker.', 'INVALID_REFERENCE');
  }
  if (worker.rows[0].status !== 'active') {
    throw new AppError(400, "That worker isn't active. Choose an active worker.", 'INVALID_REFERENCE');
  }
}

async function logHistory(
  taskId: string,
  actorId: string,
  action: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
) {
  await pool.query(
    'INSERT INTO task_history (task_id, user_id, action, old_value, new_value) VALUES ($1, $2, $3, $4, $5)',
    [
      taskId,
      actorId,
      action,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
    ],
  );
}

async function notify(params: {
  userId: string | null | undefined;
  taskId: string;
  type: 'task_assigned' | 'task_completed' | 'task_comment';
  title: string;
  message: string;
  senderName?: string | null;
}) {
  if (!params.userId) return;
  await pool.query(
    `INSERT INTO notifications (user_id, task_id, type, title, message)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [params.userId, params.taskId, params.type, params.title, params.message],
  );
  // Fire-and-forget web push; delivery failures are handled inside.
  void pushService.sendToUser(params.userId, {
    title: params.title,
    message: params.message,
    type: params.type,
    taskId: params.taskId,
  });
  // Fire-and-forget notification email; gated on SMTP + user preferences.
  void emailService.sendToUser(params.userId, {
    type: params.type,
    taskId: params.taskId,
    senderName: params.senderName,
  });
}

export interface TaskListQuery {
  search?: string;
  status?: string;
  priority?: string;
  farmId?: string;
  fieldId?: string;
  categoryId?: string;
  assignedTo?: string;
  mine: boolean;
  overdue: boolean;
  page: number;
  pageSize: number;
}

export const taskService = {
  async list(actor: AuthUser, query: TaskListQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    const scope = ownScope(actor);
    if (scope) conditions.push(`(${scope})`);

    if (query.search) {
      params.push(`%${query.search}%`);
      conditions.push(
        `(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`,
      );
    }
    if (query.status) {
      params.push(query.status);
      conditions.push(`t.status = $${params.length}`);
    }
    if (query.priority) {
      params.push(query.priority);
      conditions.push(`t.priority = $${params.length}`);
    }
    if (query.farmId) {
      params.push(query.farmId);
      conditions.push(`t.farm_id = $${params.length}`);
    }
    if (query.fieldId) {
      params.push(query.fieldId);
      conditions.push(`t.field_id = $${params.length}`);
    }
    if (query.categoryId) {
      params.push(query.categoryId);
      conditions.push(`t.category_id = $${params.length}`);
    }
    if (query.assignedTo) {
      params.push(query.assignedTo);
      conditions.push(`t.assigned_to = $${params.length}`);
    }
    if (query.mine) {
      params.push(actor.id);
      conditions.push(
        `t.assigned_to = (SELECT id FROM workers WHERE user_id = $${params.length})`,
      );
    }
    if (query.overdue) {
      conditions.push(
        `t.status <> 'finished' AND t.deadline_at IS NOT NULL AND t.deadline_at < now()`,
      );
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (query.page - 1) * query.pageSize;

    params.push(query.pageSize);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks t ${whereSql}`,
      params.slice(0, -2),
    );

    const result = await pool.query<TaskRow>(
      `${TASK_SELECT}
       ${whereSql}
       ORDER BY t.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );

    return {
      items: result.rows.map(toTask),
      total: Number(countResult.rows[0].count),
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  async get(actor: AuthUser, id: string): Promise<TaskDetail> {
    if (!isUuid.test(id)) {
      throw new AppError(404, 'This task could not be found.', 'NOT_FOUND');
    }
    const result = await pool.query<TaskRow>(`${TASK_SELECT} WHERE t.id = $1`, [id]);
    if (result.rows.length === 0) {
      throw new AppError(404, 'This task could not be found.', 'NOT_FOUND');
    }

    const scope = ownScope(actor);
    if (scope) {
      const scoped = await pool.query<{ id: string }>(
        `SELECT t.id FROM tasks t WHERE t.id = $1 AND ${scope}`,
        [id],
      );
      if (scoped.rows.length === 0) {
        throw new AppError(403, "You don't have access to this task.", 'FORBIDDEN');
      }
    }

    const comments = await pool.query<CommentRow>(
      `${COMMENT_SELECT} WHERE tc.task_id = $1 ORDER BY tc.created_at ASC`,
      [id],
    );
    const attachments = await pool.query<AttachmentRow>(
      `${ATTACHMENT_SELECT} WHERE ta.task_id = $1 ORDER BY ta.created_at ASC`,
      [id],
    );

    return {
      ...toTask(result.rows[0]),
      comments: comments.rows.map((row) => ({
        id: row.id,
        taskId: row.task_id,
        userId: row.user_id,
        userName: row.user_name,
        body: row.body,
        createdAt: row.created_at,
      })),
      attachments: attachments.rows.map((row) => ({
        id: row.id,
        taskId: row.task_id,
        uploadedBy: row.uploaded_by,
        uploadedByName: row.uploaded_by_name,
        fileName: row.file_name,
        fileType: row.file_type,
        fileSize: row.file_size,
        url: row.url,
        createdAt: row.created_at,
      })),
    };
  },

  async categories() {
    const result = await pool.query<{ id: string; name: string; icon: string | null; is_system: boolean }>(
      `SELECT id, name, icon, is_system FROM task_categories
       ORDER BY is_system DESC, (name = 'Other') ASC, name ASC`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      icon: row.icon,
      isSystem: row.is_system,
    }));
  },

  async create(
    actor: AuthUser,
    input: {
      title: string;
      description?: string | null;
      farmId: string;
      fieldId?: string | null;
      categoryId: string;
      assignedTo?: string | null;
      priority?: string;
      status?: string;
      startAt?: string | null;
      deadlineAt?: string | null;
      estimatedDurationMinutes?: number | null;
      reminderOffsetMinutes?: number | null;
      progress?: number;
    },
  ): Promise<TaskItem> {
    await assertFarmFieldCategoryPlacement(input);
    await assertAssignee(input.assignedTo);
    if (!(await canLeadFarm(actor, input.farmId))) {
      throw new AppError(403, "You can only create tasks on farms you manage.", 'FORBIDDEN');
    }

    const status = input.status ?? 'todo';
    const progress = status === 'finished' ? 100 : (input.progress ?? 0);
    const completedAt =
      status === 'finished' ? new Date().toISOString() : null;

    const id = uid();
    await pool.query(
      `INSERT INTO tasks (
         id, title, description, farm_id, field_id, category_id, assigned_to,
         assigned_by, created_by, priority, status, start_at, deadline_at,
         estimated_duration_minutes, reminder_offset_minutes, progress, completed_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        id,
        input.title,
        input.description ?? null,
        input.farmId,
        input.fieldId ?? null,
        input.categoryId,
        input.assignedTo ?? null,
        actor.id,
        input.priority ?? 'medium',
        status,
        input.startAt ?? null,
        input.deadlineAt ?? null,
        input.estimatedDurationMinutes ?? null,
        input.reminderOffsetMinutes ?? null,
        progress,
        completedAt,
      ],
    );

    const result = await pool.query<TaskRow>(`${TASK_SELECT} WHERE t.id = $1`, [id]);

    const task = toTask(result.rows[0]);
    await logHistory(task.id, actor.id, 'created', undefined, {
      title: task.title,
      farmId: task.farmId,
    });
    if (task.assignedTo) {
      await notify({
        userId: task.assigneeUserId,
        taskId: task.id,
        type: 'task_assigned',
        title: 'New task assigned',
        message: `"${task.title}" was assigned to you.`,
      });
    }
    logger.info(`Task created`, { taskId: task.id, farmId: task.farmId });
    return task;
  },

  async update(
    actor: AuthUser,
    id: string,
    input: Partial<{
      title: string;
      description: string | null;
      farmId: string;
      fieldId: string | null;
      categoryId: string;
      assignedTo: string | null;
      priority: string;
      startAt: string | null;
      deadlineAt: string | null;
      estimatedDurationMinutes: number | null;
      reminderOffsetMinutes: number | null;
      progress: number;
    }>,
  ): Promise<TaskItem> {
    if (!isUuid.test(id)) {
      throw new AppError(404, 'This task could not be found.', 'NOT_FOUND');
    }
    const current = await pool.query<{
      id: string;
      farm_id: string;
      field_id: string | null;
      category_id: string;
      assigned_to: string | null;
      created_by: string | null;
    }>(
      'SELECT id, farm_id, field_id, category_id, assigned_to, created_by FROM tasks WHERE id = $1',
      [id],
    );
    if (current.rows.length === 0) {
      throw new AppError(404, 'This task could not be found.', 'NOT_FOUND');
    }
    const task = current.rows[0];

    const nextFarmId = input.farmId ?? task.farm_id;
    if (!(await canLeadFarm(actor, nextFarmId))) {
      throw new AppError(403, "You can only update tasks on farms you manage.", 'FORBIDDEN');
    }

    const nextFieldId =
      input.fieldId !== undefined
        ? (input.fieldId ?? null)
        : input.farmId !== undefined
          ? null
          : task.field_id;
    const nextCategoryId = input.categoryId ?? task.category_id;
    await assertFarmFieldCategoryPlacement({
      farmId: nextFarmId,
      fieldId: nextFieldId,
      categoryId: nextCategoryId,
    });
    await assertAssignee(input.assignedTo === undefined ? task.assigned_to : input.assignedTo);

    const sets: string[] = [];
    const params: unknown[] = [];

    const columns: [keyof typeof input, string][] = [
      ['title', 'title'],
      ['description', 'description'],
      ['farmId', 'farm_id'],
      ['fieldId', 'field_id'],
      ['categoryId', 'category_id'],
      ['assignedTo', 'assigned_to'],
      ['priority', 'priority'],
      ['startAt', 'start_at'],
      ['deadlineAt', 'deadline_at'],
      ['estimatedDurationMinutes', 'estimated_duration_minutes'],
      ['reminderOffsetMinutes', 'reminder_offset_minutes'],
    ];

    const oldState = await pool.query<TaskRow>(`${TASK_SELECT} WHERE t.id = $1`, [id]);
    const previous = oldState.rows[0];
    const oldSnapshot: Record<string, unknown> = {};
    const newSnapshot: Record<string, unknown> = {};

    for (const [key, column] of columns) {
      if (input[key] !== undefined) {
        const value = (input[key] as string | null | number) ?? null;
        params.push(value);
        sets.push(`${column} = $${params.length}`);
        oldSnapshot[key] = column === 'title' || column === 'description'
          ? previous[column as 'title' | 'description']
          : previous[column as keyof TaskRow];
        newSnapshot[key] = value;
      }
    }

    if (input.progress !== undefined) {
      oldSnapshot.progress = previous.progress;
      newSnapshot.progress = input.progress;
      if (input.progress === 100) {
        params.push(input.progress);
        sets.push(`progress = $${params.length}`);
        params.push('finished');
        sets.push(`status = $${params.length}`);
        params.push(new Date().toISOString());
        sets.push(`completed_at = $${params.length}`);
      } else {
        params.push(input.progress);
        sets.push(`progress = $${params.length}`);
        if (previous.status === 'finished') {
          params.push('in_progress');
          sets.push(`status = $${params.length}`);
        }
        params.push(null);
        sets.push(`completed_at = $${params.length}`);
      }
    }

    if (sets.length === 0) {
      throw new AppError(400, 'Nothing to update.', 'VALIDATION_ERROR');
    }

    params.push(id);
    await pool.query(`UPDATE tasks SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);

    const after = await pool.query<TaskRow>(`${TASK_SELECT} WHERE t.id = $1`, [id]);
    const result = toTask(after.rows[0]);

    await logHistory(result.id, actor.id, 'updated', oldSnapshot, newSnapshot);

    const previousAssigneeId = task.assigned_to;
    if (result.assignedTo !== previousAssigneeId && result.assignedTo) {
      await notify({
        userId: result.assigneeUserId,
        taskId: result.id,
        type: 'task_assigned',
        title: 'Task assigned to you',
        message: `"${result.title}" was assigned to you.`,
      });
    }

    return result;
  },

  async remove(actor: AuthUser, id: string): Promise<void> {
    if (!isUuid.test(id)) {
      throw new AppError(404, 'This task could not be found.', 'NOT_FOUND');
    }
    const current = await pool.query<{ id: string; farm_id: string }>(
      'SELECT id, farm_id FROM tasks WHERE id = $1',
      [id],
    );
    if (current.rows.length === 0) {
      throw new AppError(404, 'This task could not be found.', 'NOT_FOUND');
    }
    if (!(await canLeadFarm(actor, current.rows[0].farm_id))) {
      throw new AppError(403, "You can only delete tasks on farms you manage.", 'FORBIDDEN');
    }
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    logger.info(`Task deleted`, { taskId: id });
  },

  async start(actor: AuthUser, id: string): Promise<TaskItem> {
    return this.setStatus(actor, id, 'in_progress', undefined);
  },

  async complete(actor: AuthUser, id: string): Promise<TaskItem> {
    return this.setStatus(actor, id, 'finished', undefined);
  },

  async setStatus(
    actor: AuthUser,
    id: string,
    status: 'todo' | 'in_progress' | 'finished',
    progressInput?: number,
  ): Promise<TaskItem> {
    if (!isUuid.test(id)) {
      throw new AppError(404, 'This task could not be found.', 'NOT_FOUND');
    }
    const result = await pool.query<TaskRow>(`${TASK_SELECT} WHERE t.id = $1`, [id]);
    if (result.rows.length === 0) {
      throw new AppError(404, 'This task could not be found.', 'NOT_FOUND');
    }
    const task = result.rows[0];

    const isAssignee =
      Boolean(task.assignee_user_id) && task.assignee_user_id === actor.id;
    const isCreator = task.created_by === actor.id;
    if (!(await canLeadFarm(actor, task.farm_id)) && !isAssignee && !isCreator) {
      throw new AppError(403, "You can't change this task's status.", 'FORBIDDEN');
    }

    const sets: string[] = [];
    const params: unknown[] = [];

    let progress = progressInput ?? task.progress;
    if (status === 'finished') progress = 100;

    params.push(status);
    sets.push(`status = $${params.length}`);
    params.push(progress);
    sets.push(`progress = $${params.length}`);

    if (status === 'in_progress') {
      params.push(new Date().toISOString());
      sets.push(`start_at = CASE WHEN start_at IS NULL THEN $${params.length} ELSE start_at END`);
      params.push(null);
      sets.push(`completed_at = $${params.length}`);
    } else if (status === 'finished') {
      params.push(new Date().toISOString());
      sets.push(`completed_at = CASE WHEN completed_at IS NULL THEN $${params.length} ELSE completed_at END`);
      params.push(new Date().toISOString());
      sets.push(
        `actual_duration_minutes = CASE
           WHEN start_at IS NOT NULL THEN GREATEST(1, TIMESTAMPDIFF(MINUTE, start_at, $${params.length}))
           ELSE NULL END`,
      );
    } else {
      params.push(null);
      sets.push(`completed_at = $${params.length}`);
    }

    params.push(id);
    await pool.query(`UPDATE tasks SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);

    const after = await pool.query<TaskRow>(`${TASK_SELECT} WHERE t.id = $1`, [id]);
    const updated = toTask(after.rows[0]);

    await logHistory(updated.id, actor.id, status, undefined, {
      status: updated.status,
      progress: updated.progress,
    });

    if (status === 'finished') {
      const title = 'Task completed';
      const message = `"${updated.title}" was marked complete.`;
      await notify({ userId: task.assigned_by, taskId: updated.id, type: 'task_completed', title, message });
      if (task.created_by !== task.assigned_by) {
        await notify({ userId: task.created_by, taskId: updated.id, type: 'task_completed', title: title, message: message });
      }
    }

    return updated;
  },

  async addComment(actor: AuthUser, id: string, body: string): Promise<TaskCommentItem> {
    if (!isUuid.test(id)) {
      throw new AppError(404, 'This task could not be found.', 'NOT_FOUND');
    }
    const result = await pool.query<TaskRow>(`${TASK_SELECT} WHERE t.id = $1`, [id]);
    if (result.rows.length === 0) {
      throw new AppError(404, 'This task could not be found.', 'NOT_FOUND');
    }
    const scope = ownScope(actor);
    if (scope) {
      const scoped = await pool.query<{ id: string }>(
        `SELECT t.id FROM tasks t WHERE t.id = $1 AND ${scope}`,
        [id],
      );
      if (scoped.rows.length === 0) {
        throw new AppError(403, "You don't have access to this task.", 'FORBIDDEN');
      }
    }

    const commentId = uid();
    await pool.query(
      'INSERT INTO task_comments (id, task_id, user_id, body) VALUES ($1, $2, $3, $4)',
      [commentId, id, actor.id, body],
    );
    const inserted = await pool.query<CommentRow>(
      `${COMMENT_SELECT} WHERE tc.id = $1`,
      [commentId],
    );
    const comment = inserted.rows[0];

    await notify({
      userId: result.rows[0].assigned_by,
      taskId: id,
      type: 'task_comment',
      title: 'New comment on your task',
      message: `${comment.user_name ?? 'Someone'} commented on "${result.rows[0].title}".`,
      senderName: comment.user_name,
    });

    return {
      id: comment.id,
      taskId: comment.task_id,
      userId: comment.user_id,
      userName: comment.user_name,
      body: comment.body,
      createdAt: comment.created_at,
    };
  },

  async addAttachment(
    actor: AuthUser,
    id: string,
    file: { originalName: string; mimeType: string; size: number; storageKey: string },
  ): Promise<TaskAttachmentItem> {
    if (!isUuid.test(id)) {
      throw new AppError(404, 'This task could not be found.', 'NOT_FOUND');
    }
    const result = await pool.query<TaskRow>(`${TASK_SELECT} WHERE t.id = $1`, [id]);
    if (result.rows.length === 0) {
      throw new AppError(404, 'This task could not be found.', 'NOT_FOUND');
    }
    const task = result.rows[0];
    const isAssignee = Boolean(task.assignee_user_id) && task.assignee_user_id === actor.id;
    const isCreator = task.created_by === actor.id;
    if (!(await canLeadFarm(actor, task.farm_id)) && !isAssignee && !isCreator) {
      throw new AppError(403, "You can't attach files to this task.", 'FORBIDDEN');
    }

    const url = `/uploads/${file.storageKey}`;
    const attachmentId = uid();
    await pool.query(
      `INSERT INTO task_attachments (id, task_id, uploaded_by, file_name, file_type, file_size, storage_key, url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [attachmentId, id, actor.id, file.originalName, file.mimeType, file.size, file.storageKey, url],
    );
    const inserted = await pool.query<AttachmentRow>(
      `${ATTACHMENT_SELECT} WHERE ta.id = $1`,
      [attachmentId],
    );
    return {
      id: inserted.rows[0].id,
      taskId: inserted.rows[0].task_id,
      uploadedBy: inserted.rows[0].uploaded_by,
      uploadedByName: inserted.rows[0].uploaded_by_name,
      fileName: inserted.rows[0].file_name,
      fileType: inserted.rows[0].file_type,
      fileSize: inserted.rows[0].file_size,
      url: inserted.rows[0].url,
      createdAt: inserted.rows[0].created_at,
    };
  },

  async removeAttachment(actor: AuthUser, attachmentId: string): Promise<void> {
    if (!isUuid.test(attachmentId)) {
      throw new AppError(404, 'This attachment could not be found.', 'NOT_FOUND');
    }
    const result = await pool.query<{ id: string; task_id: string; storage_key: string; uploaded_by: string | null }>(
      'SELECT id, task_id, storage_key, uploaded_by FROM task_attachments WHERE id = $1',
      [attachmentId],
    );
    if (result.rows.length === 0) {
      throw new AppError(404, 'This attachment could not be found.', 'NOT_FOUND');
    }
    const attachment = result.rows[0];
    const task = await pool.query<{ farm_id: string; created_by: string | null }>(
      'SELECT farm_id, created_by FROM tasks WHERE id = $1',
      [attachment.task_id],
    );
    const isCreator = task.rows[0]?.created_by === actor.id;
    const isUploader = attachment.uploaded_by === actor.id;
    if (!(await canLeadFarm(actor, task.rows[0].farm_id)) && !isCreator && !isUploader) {
      throw new AppError(403, "You can't remove this attachment.", 'FORBIDDEN');
    }

    await pool.query('DELETE FROM task_attachments WHERE id = $1', [attachmentId]);
    const filePath = path.join(UPLOADS_DIR, attachment.storage_key);
    await fs.unlink(filePath).catch(() => undefined);
  },
};