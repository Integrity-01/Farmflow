-- Remember which organization each session is currently acting within, so a
-- user who belongs to more than one organization keeps the one they switched
-- to across requests and page reloads.
ALTER TABLE sessions
  ADD COLUMN active_organization_id VARCHAR(36) NULL,
  ADD KEY idx_sessions_active_org (active_organization_id),
  ADD CONSTRAINT fk_sessions_active_org
    FOREIGN KEY (active_organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
