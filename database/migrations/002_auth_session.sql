-- Session management for refresh tokens
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  user_agent TEXT,
  ip TEXT,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME,
  last_used_at DATETIME NOT NULL DEFAULT now(),
  created_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_sessions_token_hash (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at)
);

-- Password reset tokens (hashed, single use)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_password_reset_tokens_hash (token_hash)
);

-- Expired auth tokens are purged by the app's cleanup job instead of a
-- Postgres-style stored function.