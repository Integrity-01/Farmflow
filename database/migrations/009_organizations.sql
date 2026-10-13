-- FarmFlow - Multi-organization foundation: organizations, memberships,
-- invitations, access keys, and a role/permission model.
-- Applied via the migration runner in backend/src/database/migrate.ts

CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  name VARCHAR(255) NOT NULL,
  logo_url TEXT NULL,
  contact_email VARCHAR(255) NULL,
  website VARCHAR(255) NULL,
  country VARCHAR(60) NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Lagos',
  status ENUM('active', 'suspended', 'pending') NOT NULL DEFAULT 'active',
  verification_status ENUM('unverified', 'verified') NOT NULL DEFAULT 'unverified',
  settings TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_memberships (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  organization_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role_id VARCHAR(36) NOT NULL,
  status ENUM('pending', 'active', 'suspended') NOT NULL DEFAULT 'pending',
  joined_at DATETIME NULL,
  decided_by VARCHAR(36) NULL,
  decided_at DATETIME NULL,
  declined_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_membership_org_user (organization_id, user_id),
  KEY idx_membership_user (user_id, status),
  KEY idx_membership_org (organization_id, status),
  KEY idx_membership_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_invitations (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  organization_id VARCHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  status ENUM('pending', 'accepted', 'revoked') NOT NULL DEFAULT 'pending',
  invited_by VARCHAR(36) NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_invitations_org_email (organization_id, email),
  KEY idx_invitations_token (token_hash),
  KEY idx_invitations_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS access_keys (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  organization_id VARCHAR(36) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  label VARCHAR(120) NULL,
  created_by VARCHAR(36) NULL,
  expires_at DATETIME NULL,
  revoked_at DATETIME NULL,
  last_used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_access_keys_hash (code_hash),
  KEY idx_access_keys_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  organization_id VARCHAR(36) NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_roles_org_code (organization_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  code VARCHAR(80) NOT NULL,
  module VARCHAR(40) NOT NULL DEFAULT 'system',
  description VARCHAR(255) NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(36) NOT NULL,
  permission_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (role_id, permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Organization scoping on existing tables (nullable; backfilled per farm membership)
ALTER TABLE farms
  ADD COLUMN organization_id VARCHAR(36) NULL,
  ADD KEY idx_farms_org (organization_id);

ALTER TABLE inputs
  ADD COLUMN organization_id VARCHAR(36) NULL,
  ADD KEY idx_inputs_org (organization_id);

ALTER TABLE notifications
  ADD COLUMN organization_id VARCHAR(36) NULL,
  ADD KEY idx_notifications_org (organization_id);

ALTER TABLE reports
  ADD COLUMN organization_id VARCHAR(36) NULL,
  ADD KEY idx_reports_org (organization_id);

ALTER TABLE sessions
  ADD COLUMN organization_id VARCHAR(36) NULL,
  ADD KEY idx_sessions_org (organization_id);

ALTER TABLE tasks
  ADD COLUMN organization_id VARCHAR(36) NULL,
  ADD KEY idx_tasks_org (organization_id);

ALTER TABLE task_categories
  ADD COLUMN organization_id VARCHAR(36) NULL,
  ADD KEY idx_task_categories_org (organization_id);

ALTER TABLE workers
  ADD COLUMN organization_id VARCHAR(36) NULL,
  ADD KEY idx_workers_org (organization_id);

-- Built-in roles
INSERT IGNORE INTO roles (id, organization_id, code, name, description, is_system) VALUES
  ('298f41b0-c617-11f1-90f3-74d83eab2466', NULL, 'organization_administrator', 'Organization Administrator', 'Full control over the organization, members, roles and data.', 1),
  ('298f6110-c617-11f1-90f3-74d83eab2466', NULL, 'farm_manager', 'Farm Manager', 'Manages farms, workers, tasks, inventory and team invitations.', 1),
  ('298f6270-c617-11f1-90f3-74d83eab2466', NULL, 'supervisor', 'Supervisor / M&E', 'Creates and manages farms and tasks; monitors field operations.', 1),
  ('298f633c-c617-11f1-90f3-74d83eab2466', NULL, 'field_officer', 'Field Officer', 'Creates and completes tasks, reports progress, views assigned farms.', 1);

-- Permission catalog
INSERT IGNORE INTO permissions (id, code, module, description, is_system) VALUES
  ('298880d2-c617-11f1-90f3-74d83eab2466', 'org:view', 'organization', 'View organization details and settings', 1),
  ('298cb735-c617-11f1-90f3-74d83eab2466', 'org:update', 'organization', 'Update organization details', 1),
  ('298cb8bb-c617-11f1-90f3-74d83eab2466', 'org:manage', 'organization', 'Manage organization lifecycle', 1),
  ('298cb935-c617-11f1-90f3-74d83eab2466', 'member:invite', 'members', 'Invite and join people to the organization', 1),
  ('298cb9ae-c617-11f1-90f3-74d83eab2466', 'member:approve', 'members', 'Approve or reject membership requests', 1),
  ('298cba1c-c617-11f1-90f3-74d83eab2466', 'member:manage', 'members', 'Change member roles and suspend accounts', 1),
  ('298cc219-c617-11f1-90f3-74d83eab2466', 'role:manage', 'roles', 'Create and manage custom roles', 1),
  ('298cc293-c617-11f1-90f3-74d83eab2466', 'access_key:manage', 'roles', 'Create and revoke organization access keys', 1),
  ('298cc302-c617-11f1-90f3-74d83eab2466', 'farm:view', 'farms', 'View farms', 1),
  ('298cc370-c617-11f1-90f3-74d83eab2466', 'farm:create', 'farms', 'Create farms', 1),
  ('298cc3e1-c617-11f1-90f3-74d83eab2466', 'farm:update', 'farms', 'Update farms', 1),
  ('298cc444-c617-11f1-90f3-74d83eab2466', 'farm:delete', 'farms', 'Delete farms', 1),
  ('298cc4ae-c617-11f1-90f3-74d83eab2466', 'worker:view', 'workers', 'View workers', 1),
  ('298cc516-c617-11f1-90f3-74d83eab2466', 'worker:create', 'workers', 'Add workers', 1),
  ('298cc583-c617-11f1-90f3-74d83eab2466', 'worker:update', 'workers', 'Update workers', 1),
  ('298cc5f6-c617-11f1-90f3-74d83eab2466', 'worker:delete', 'workers', 'Remove workers', 1),
  ('298cc662-c617-11f1-90f3-74d83eab2466', 'task:view', 'tasks', 'View tasks', 1),
  ('298cc6d2-c617-11f1-90f3-74d83eab2466', 'task:create', 'tasks', 'Create tasks', 1),
  ('298cc738-c617-11f1-90f3-74d83eab2466', 'task:update', 'tasks', 'Update tasks', 1),
  ('298cc79f-c617-11f1-90f3-74d83eab2466', 'task:delete', 'tasks', 'Delete tasks', 1),
  ('298cc812-c617-11f1-90f3-74d83eab2466', 'task:comment', 'tasks', 'Comment on tasks', 1),
  ('298cc882-c617-11f1-90f3-74d83eab2466', 'task:attach', 'tasks', 'Attach files to tasks', 1),
  ('298cc8fa-c617-11f1-90f3-74d83eab2466', 'task:complete', 'tasks', 'Mark tasks complete or in progress', 1),
  ('298cc94c-c617-11f1-90f3-74d83eab2466', 'inventory:view', 'inventory', 'View inventory', 1),
  ('298cc99b-c617-11f1-90f3-74d83eab2466', 'inventory:create', 'inventory', 'Add or receive stock', 1),
  ('298cca07-c617-11f1-90f3-74d83eab2466', 'inventory:update', 'inventory', 'Update stock levels', 1),
  ('298cca7d-c617-11f1-90f3-74d83eab2466', 'inventory:delete', 'inventory', 'Delete inventory records', 1),
  ('298ccae9-c617-11f1-90f3-74d83eab2466', 'report:view', 'reports', 'View reports', 1),
  ('298ccb57-c617-11f1-90f3-74d83eab2466', 'report:create', 'reports', 'Generate reports', 1),
  ('298ccbc3-c617-11f1-90f3-74d83eab2466', 'analytics:view', 'analytics', 'View analytics and dashboards', 1),
  ('298ccc2f-c617-11f1-90f3-74d83eab2466', 'history:view', 'history', 'View activity history', 1),
  ('298ccc9b-c617-11f1-90f3-74d83eab2466', 'weather:view', 'weather', 'View weather forecasts', 1),
  ('298ccce8-c617-11f1-90f3-74d83eab2466', 'ai:use', 'assistant', 'Use the AI assistant', 1);

-- Built-in role -> permission grants
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (
  SELECT 'organization_administrator' AS role_code, 'org:view' AS perm_code
  UNION ALL SELECT 'organization_administrator', 'org:update'
  UNION ALL SELECT 'organization_administrator', 'org:manage'
  UNION ALL SELECT 'organization_administrator', 'member:invite'
  UNION ALL SELECT 'organization_administrator', 'member:approve'
  UNION ALL SELECT 'organization_administrator', 'member:manage'
  UNION ALL SELECT 'organization_administrator', 'role:manage'
  UNION ALL SELECT 'organization_administrator', 'access_key:manage'
  UNION ALL SELECT 'organization_administrator', 'farm:view'
  UNION ALL SELECT 'organization_administrator', 'farm:create'
  UNION ALL SELECT 'organization_administrator', 'farm:update'
  UNION ALL SELECT 'organization_administrator', 'farm:delete'
  UNION ALL SELECT 'organization_administrator', 'worker:view'
  UNION ALL SELECT 'organization_administrator', 'worker:create'
  UNION ALL SELECT 'organization_administrator', 'worker:update'
  UNION ALL SELECT 'organization_administrator', 'worker:delete'
  UNION ALL SELECT 'organization_administrator', 'task:view'
  UNION ALL SELECT 'organization_administrator', 'task:create'
  UNION ALL SELECT 'organization_administrator', 'task:update'
  UNION ALL SELECT 'organization_administrator', 'task:delete'
  UNION ALL SELECT 'organization_administrator', 'task:comment'
  UNION ALL SELECT 'organization_administrator', 'task:attach'
  UNION ALL SELECT 'organization_administrator', 'task:complete'
  UNION ALL SELECT 'organization_administrator', 'inventory:view'
  UNION ALL SELECT 'organization_administrator', 'inventory:create'
  UNION ALL SELECT 'organization_administrator', 'inventory:update'
  UNION ALL SELECT 'organization_administrator', 'inventory:delete'
  UNION ALL SELECT 'organization_administrator', 'report:view'
  UNION ALL SELECT 'organization_administrator', 'report:create'
  UNION ALL SELECT 'organization_administrator', 'analytics:view'
  UNION ALL SELECT 'organization_administrator', 'history:view'
  UNION ALL SELECT 'organization_administrator', 'weather:view'
  UNION ALL SELECT 'organization_administrator', 'ai:use'
  UNION ALL SELECT 'farm_manager', 'org:view'
  UNION ALL SELECT 'farm_manager', 'member:invite'
  UNION ALL SELECT 'farm_manager', 'farm:view'
  UNION ALL SELECT 'farm_manager', 'farm:create'
  UNION ALL SELECT 'farm_manager', 'farm:update'
  UNION ALL SELECT 'farm_manager', 'farm:delete'
  UNION ALL SELECT 'farm_manager', 'worker:view'
  UNION ALL SELECT 'farm_manager', 'worker:create'
  UNION ALL SELECT 'farm_manager', 'worker:update'
  UNION ALL SELECT 'farm_manager', 'worker:delete'
  UNION ALL SELECT 'farm_manager', 'task:view'
  UNION ALL SELECT 'farm_manager', 'task:create'
  UNION ALL SELECT 'farm_manager', 'task:update'
  UNION ALL SELECT 'farm_manager', 'task:delete'
  UNION ALL SELECT 'farm_manager', 'task:comment'
  UNION ALL SELECT 'farm_manager', 'task:attach'
  UNION ALL SELECT 'farm_manager', 'task:complete'
  UNION ALL SELECT 'farm_manager', 'inventory:view'
  UNION ALL SELECT 'farm_manager', 'inventory:create'
  UNION ALL SELECT 'farm_manager', 'inventory:update'
  UNION ALL SELECT 'farm_manager', 'inventory:delete'
  UNION ALL SELECT 'farm_manager', 'report:view'
  UNION ALL SELECT 'farm_manager', 'report:create'
  UNION ALL SELECT 'farm_manager', 'analytics:view'
  UNION ALL SELECT 'farm_manager', 'history:view'
  UNION ALL SELECT 'farm_manager', 'weather:view'
  UNION ALL SELECT 'farm_manager', 'ai:use'
  UNION ALL SELECT 'supervisor', 'org:view'
  UNION ALL SELECT 'supervisor', 'farm:view'
  UNION ALL SELECT 'supervisor', 'farm:create'
  UNION ALL SELECT 'supervisor', 'farm:update'
  UNION ALL SELECT 'supervisor', 'worker:view'
  UNION ALL SELECT 'supervisor', 'worker:create'
  UNION ALL SELECT 'supervisor', 'task:view'
  UNION ALL SELECT 'supervisor', 'task:create'
  UNION ALL SELECT 'supervisor', 'task:update'
  UNION ALL SELECT 'supervisor', 'task:delete'
  UNION ALL SELECT 'supervisor', 'task:comment'
  UNION ALL SELECT 'supervisor', 'task:attach'
  UNION ALL SELECT 'supervisor', 'task:complete'
  UNION ALL SELECT 'supervisor', 'inventory:view'
  UNION ALL SELECT 'supervisor', 'report:view'
  UNION ALL SELECT 'supervisor', 'analytics:view'
  UNION ALL SELECT 'supervisor', 'history:view'
  UNION ALL SELECT 'supervisor', 'weather:view'
  UNION ALL SELECT 'supervisor', 'ai:use'
  UNION ALL SELECT 'field_officer', 'org:view'
  UNION ALL SELECT 'field_officer', 'farm:view'
  UNION ALL SELECT 'field_officer', 'task:view'
  UNION ALL SELECT 'field_officer', 'task:create'
  UNION ALL SELECT 'field_officer', 'task:update'
  UNION ALL SELECT 'field_officer', 'task:comment'
  UNION ALL SELECT 'field_officer', 'task:attach'
  UNION ALL SELECT 'field_officer', 'task:complete'
  UNION ALL SELECT 'field_officer', 'history:view'
  UNION ALL SELECT 'field_officer', 'weather:view'
) m
JOIN roles r ON r.code = m.role_code
JOIN permissions p ON p.code = m.perm_code;
