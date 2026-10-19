import { pool, uid } from '../database/pool.js';
import { logger } from '../utils/logger.js';

export type AuditActorType = 'user' | 'system_admin' | 'system';

export interface AuditInput {
  actorType?: AuditActorType;
  actorUserId?: string | null;
  /** system_administrators.id when actorType is 'system_admin'. */
  actorAdminId?: string | null;
  organizationId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  metadata?: unknown;
}

/**
 * Append a security/administrative event to `audit_logs`. Audit writes must
 * never break the primary operation, so failures are logged and swallowed.
 *
 * Never pass secrets (passwords, tokens, raw access keys) in `metadata`.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  const actorType: AuditActorType =
    input.actorType ?? (input.actorAdminId ? 'system_admin' : 'user');
  try {
    await pool.query(
      `INSERT INTO audit_logs
         (id, actor_type, actor_user_id, actor_admin_id, organization_id, action,
          target_type, target_id, ip, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        uid(),
        actorType,
        input.actorUserId ?? null,
        input.actorAdminId ?? null,
        input.organizationId ?? null,
        input.action,
        input.targetType ?? null,
        input.targetId ?? null,
        input.ip ?? null,
        input.metadata === undefined ? null : JSON.stringify(input.metadata),
      ],
    );
  } catch (error) {
    logger.error('Failed to write audit log', {
      action: input.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
