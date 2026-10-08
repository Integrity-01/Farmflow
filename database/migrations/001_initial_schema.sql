-- FarmFlow — initial schema (MySQL/MariaDB)
-- Applied via the migration runner in backend/src/database/migrate.ts

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name TEXT NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone TEXT,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('administrator', 'farm_manager', 'supervisor', 'field_worker') NOT NULL DEFAULT 'field_worker',
  avatar_url TEXT,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_users_email (email)
);

-- ============================================================
-- Farms
-- ============================================================
CREATE TABLE IF NOT EXISTS farms (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  location TEXT,
  description TEXT,
  size DECIMAL(12, 2),
  size_unit VARCHAR(255) NOT NULL DEFAULT 'hectares',
  manager_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  status ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_farms_name (name),
  KEY idx_farms_manager (manager_id)
);

-- ============================================================
-- Fields
-- ============================================================
CREATE TABLE IF NOT EXISTS fields (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  farm_id VARCHAR(36) NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  size DECIMAL(12, 2),
  size_unit VARCHAR(255) NOT NULL DEFAULT 'hectares',
  crop TEXT,
  crop_variety TEXT,
  planting_date DATE,
  expected_harvest_date DATE,
  status ENUM('active', 'fallow', 'harvested', 'inactive') NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_fields_farm_name (farm_id, name)
);

-- ============================================================
-- Workers
-- ============================================================
CREATE TABLE IF NOT EXISTS workers (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role TEXT,
  farm_id VARCHAR(36) REFERENCES farms(id) ON DELETE SET NULL,
  field_id VARCHAR(36) REFERENCES fields(id) ON DELETE SET NULL,
  status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  skills TEXT,
  joined_at DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_workers_user (user_id),
  KEY idx_workers_farm (farm_id),
  KEY idx_workers_field (field_id)
);

-- ============================================================
-- Task categories
-- ============================================================
CREATE TABLE IF NOT EXISTS task_categories (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  icon TEXT,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_task_categories_name (name)
);

-- ============================================================
-- Tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  title TEXT NOT NULL,
  description TEXT,
  farm_id VARCHAR(36) NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  field_id VARCHAR(36) REFERENCES fields(id) ON DELETE SET NULL,
  category_id VARCHAR(36) NOT NULL REFERENCES task_categories(id) ON DELETE RESTRICT,
  assigned_to VARCHAR(36) REFERENCES workers(id) ON DELETE SET NULL,
  assigned_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  priority ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  status ENUM('todo', 'in_progress', 'finished') NOT NULL DEFAULT 'todo',
  start_at DATETIME,
  deadline_at DATETIME,
  estimated_duration_minutes INT,
  actual_duration_minutes INT,
  progress SMALLINT NOT NULL DEFAULT 0,
  reminder_offset_minutes INT,
  reminder_sent_at DATETIME,
  overdue_notified_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  CONSTRAINT chk_tasks_progress CHECK (progress BETWEEN 0 AND 100),
  KEY idx_tasks_status (status),
  KEY idx_tasks_deadline (deadline_at),
  KEY idx_tasks_status_deadline (status, deadline_at),
  KEY idx_tasks_assigned_to (assigned_to),
  KEY idx_tasks_assigned_to_status (assigned_to, status),
  KEY idx_tasks_farm (farm_id),
  KEY idx_tasks_field (field_id),
  KEY idx_tasks_category (category_id),
  KEY idx_tasks_created_by (created_by),
  KEY idx_tasks_created_at (created_at)
);

-- ============================================================
-- Task comments
-- ============================================================
CREATE TABLE IF NOT EXISTS task_comments (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  task_id VARCHAR(36) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_task_comments_task (task_id)
);

-- ============================================================
-- Task attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS task_attachments (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  task_id VARCHAR(36) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INT NOT NULL,
  storage_key TEXT NOT NULL,
  url TEXT,
  created_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_task_attachments_task (task_id)
);

-- ============================================================
-- Task history (audit trail, append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_history (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  task_id VARCHAR(36) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata TEXT,
  created_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_task_history_task (task_id, created_at)
);

-- ============================================================
-- Notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id VARCHAR(36) REFERENCES tasks(id) ON DELETE CASCADE,
  type ENUM(
    'task_assigned',
    'task_reminder',
    'task_due_soon',
    'task_due_today',
    'task_overdue',
    'task_completed',
    'task_comment',
    'daily_summary',
    'system'
  ) NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME,
  sent_at DATETIME NOT NULL DEFAULT now(),
  created_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_notifications_user (user_id, is_read, created_at)
);

-- ============================================================
-- Notification preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled TINYINT(1) NOT NULL DEFAULT 1,
  push_enabled TINYINT(1) NOT NULL DEFAULT 1,
  in_app_enabled TINYINT(1) NOT NULL DEFAULT 1,
  task_assignments TINYINT(1) NOT NULL DEFAULT 1,
  deadline_reminders TINYINT(1) NOT NULL DEFAULT 1,
  overdue_alerts TINYINT(1) NOT NULL DEFAULT 1,
  task_completions TINYINT(1) NOT NULL DEFAULT 1,
  daily_summary TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT now()
);

-- ============================================================
-- Push subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint VARCHAR(512) NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_push_subscriptions_endpoint (endpoint),
  KEY idx_push_subscriptions_user (user_id)
);

-- ============================================================
-- Reports
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL,
  filters TEXT,
  format ENUM('excel', 'csv', 'pdf') NOT NULL DEFAULT 'csv',
  status VARCHAR(64) NOT NULL DEFAULT 'pending',
  file_url TEXT,
  error_message TEXT,
  started_at DATETIME NOT NULL DEFAULT now(),
  completed_at DATETIME,
  KEY idx_reports_created_by (created_by, started_at)
);

-- ============================================================
-- Default system task categories
-- ============================================================
INSERT IGNORE INTO task_categories (name, icon, is_system) VALUES
  ('Land Clearing', 'land-clearing', 1),
  ('Land Preparation', 'land-preparation', 1),
  ('Ploughing', 'ploughing', 1),
  ('Harrowing', 'harrowing', 1),
  ('Ridging', 'ridging', 1),
  ('Planting', 'planting', 1),
  ('Seed Treatment', 'seed-treatment', 1),
  ('Fertilization', 'fertilization', 1),
  ('Weeding', 'weeding', 1),
  ('Irrigation', 'irrigation', 1),
  ('Pest Control', 'pest-control', 1),
  ('Disease Control', 'disease-control', 1),
  ('Spraying', 'spraying', 1),
  ('Pruning', 'pruning', 1),
  ('Crop Monitoring', 'crop-monitoring', 1),
  ('Farm Inspection', 'farm-inspection', 1),
  ('Harvest', 'harvest', 1),
  ('Sorting', 'sorting', 1),
  ('Processing', 'processing', 1),
  ('Packaging', 'packaging', 1),
  ('Storage', 'storage', 1),
  ('Transportation', 'transportation', 1),
  ('Equipment Maintenance', 'equipment-maintenance', 1),
  ('Farm Cleaning', 'farm-cleaning', 1),
  ('Security', 'security', 1),
  ('Livestock Management', 'livestock-management', 1),
  ('Other', 'other', 1);