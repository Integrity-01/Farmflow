-- FarmFlow - WhatsApp-first channel (phone links + notification pref)
-- Applied via the migration runner in backend/src/database/migrate.ts

CREATE TABLE IF NOT EXISTS whatsapp_links (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  whatsapp_number VARCHAR(32) NULL,
  wa_name VARCHAR(255) NULL,
  invite_code VARCHAR(8) NOT NULL,
  status ENUM('invited', 'active', 'revoked') NOT NULL DEFAULT 'invited',
  last_session_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now() ON UPDATE now(),
  UNIQUE KEY uq_whatsapp_links_user (user_id),
  UNIQUE KEY uq_whatsapp_links_invite (invite_code),
  UNIQUE KEY uq_whatsapp_links_number (whatsapp_number),
  CONSTRAINT fk_whatsapp_links_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE notification_preferences
  ADD COLUMN whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0
  AFTER in_app_enabled;