/**
 * Pure SQL-fragment helpers for the analytics service.
 *
 * Kept free of database imports so they can be unit tested without opening a
 * connection pool.
 */

export function rangeCondition(days: number): string {
  if (!days || days <= 0) return '';
  return `t.created_at >= now() - INTERVAL ${days} DAY`;
}

/**
 * Builds the WHERE clause shared by the task-based analytics queries. The
 * scope predicate is optional (farm managers see every task), so the keyword
 * must only appear when at least one condition exists — otherwise the SQL is
 * syntactically invalid (`... FROM tasks t AND t.created_at >= ...`).
 */
export function composeTaskWhere(scope: string, days: number): string {
  const conditions = [scope, rangeCondition(days)].filter(Boolean);
  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}
