-- FarmFlow - Administrator login credentials and audit logs.
-- Adds a dedicated administrator login identifier system (Admin ID) that maps
-- an administrator's login ID to an internal user identity + organization, plus
-- a general-purpose audit log for sensitive administrative/security actions.
-- Applied via the migration runner in backend/src/database/migrate.ts

CREATE TABLE IF NOT EXISTS administrator_login_credentials (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  admin_id VARCHAR(40) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  organization_id VARCHAR(36) NOT NULL,
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_admin_credentials_admin_id (admin_id),
  UNIQUE KEY uq_admin_credentials_user_org (user_id, organization_id),
  KEY idx_admin_credentials_user (user_id),
  KEY idx_admin_credentials_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  actor_user_id VARCHAR(36) NULL,
  organization_id VARCHAR(36) NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(40) NULL,
  target_id VARCHAR(64) NULL,
  metadata TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_audit_logs_org (organization_id, created_at),
  KEY idx_audit_logs_actor (actor_user_id, created_at),
  KEY idx_audit_logs_action (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
