-- FarmFlow - Central System Administrator environment.
-- A platform-level identity store that is fully separate from the tenant model
-- (`users` + `organization_memberships`). A system administrator is NEVER an
-- organization user and vice versa; organization administrators never gain
-- platform privileges. Applied via backend/src/database/migrate.ts

CREATE TABLE IF NOT EXISTS system_administrators (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  admin_id VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  is_owner TINYINT(1) NOT NULL DEFAULT 0,
  mfa_enabled TINYINT(1) NOT NULL DEFAULT 0,
  mfa_secret VARCHAR(255) NULL,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  last_login_at DATETIME NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_system_admins_admin_id (admin_id),
  UNIQUE KEY uq_system_admins_email (email),
  KEY idx_system_admins_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System administrator sessions. Deliberately separate from `sessions` (which
-- belongs to organization users) so a token from one environment can never be
-- replayed against the other.
CREATE TABLE IF NOT EXISTS system_admin_sessions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  system_admin_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  mfa_verified TINYINT(1) NOT NULL DEFAULT 0,
  user_agent TEXT,
  ip TEXT,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME,
  last_used_at DATETIME NOT NULL DEFAULT now(),
  created_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_system_sessions_token (token_hash),
  KEY idx_system_sessions_admin (system_admin_id),
  KEY idx_system_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Self-service password resets for system administrators. Kept separate from
-- `password_reset_tokens` (which has a FK to `users`) so the two identity
-- families never share credential-recovery state.
CREATE TABLE IF NOT EXISTS system_admin_password_resets (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  system_admin_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_system_password_resets_token (token_hash),
  KEY idx_system_password_resets_admin (system_admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Extend the existing audit log to attribute platform-level events without
-- breaking existing organization audit rows (which keep actor_type 'user').
ALTER TABLE audit_logs
  ADD COLUMN actor_type ENUM('user', 'system_admin', 'system') NOT NULL DEFAULT 'user',
  ADD COLUMN actor_admin_id VARCHAR(36) NULL,
  ADD COLUMN ip VARCHAR(64) NULL,
  ADD KEY idx_audit_logs_actor_admin (actor_admin_id, created_at),
  ADD KEY idx_audit_logs_actor_type (actor_type, created_at);

-- Indexes for platform-wide aggregation and organization listing.
ALTER TABLE organizations
  ADD KEY idx_organizations_status_created (status, created_at),
  ADD KEY idx_organizations_created (created_at);

ALTER TABLE users
  ADD KEY idx_users_created (created_at);

ALTER TABLE tasks
  ADD KEY idx_tasks_org_status (organization_id, status);

ALTER TABLE farms
  ADD KEY idx_farms_created (created_at);
