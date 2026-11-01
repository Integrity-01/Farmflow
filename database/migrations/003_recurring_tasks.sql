
-- ============================================================
-- Recurring tasks (multi-generation rules that create task instances)
-- ============================================================

CREATE TABLE IF NOT EXISTS recurring_tasks (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),

  title TEXT NOT NULL,
  description TEXT,

  farm_id VARCHAR(36) NOT NULL,
  field_id VARCHAR(36),
  category_id VARCHAR(36) NOT NULL,
  assigned_to VARCHAR(36),
  created_by VARCHAR(36),

  priority ENUM('low', 'medium', 'high', 'critical')
    NOT NULL DEFAULT 'medium',

  frequency ENUM('daily', 'weekly', 'monthly')
    NOT NULL,

  interval_count INT NOT NULL DEFAULT 1,

  -- Stores selected weekdays as a JSON string, e.g. [1,3,5]
  weekdays TEXT,

  day_of_month INT,

  start_time_minutes INT NOT NULL DEFAULT 420,
  estimated_duration_minutes INT,
  reminder_offset_minutes INT,

  start_date DATE NOT NULL,
  end_date DATE,

  active TINYINT(1) NOT NULL DEFAULT 1,
  skip_next TINYINT(1) NOT NULL DEFAULT 0,

  next_run_at DATETIME,
  last_generated_at DATETIME,

  generated_count INT NOT NULL DEFAULT 0,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_recurring_farm
    FOREIGN KEY (farm_id)
    REFERENCES farms(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_recurring_field
    FOREIGN KEY (field_id)
    REFERENCES fields(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_recurring_category
    FOREIGN KEY (category_id)
    REFERENCES task_categories(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_recurring_assigned
    FOREIGN KEY (assigned_to)
    REFERENCES workers(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_recurring_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT chk_recurring_frequency
    CHECK (frequency IN ('daily', 'weekly', 'monthly')),

  CONSTRAINT chk_recurring_interval
    CHECK (interval_count >= 1),

  CONSTRAINT chk_recurring_day_of_month
    CHECK (
      day_of_month IS NULL
      OR (day_of_month >= 1 AND day_of_month <= 31)
    ),

  CONSTRAINT chk_recurring_start_time
    CHECK (
      start_time_minutes >= 0
      AND start_time_minutes < 1440
    ),

  CONSTRAINT chk_recurring_duration
    CHECK (
      estimated_duration_minutes IS NULL
      OR estimated_duration_minutes >= 1
    ),

  CONSTRAINT chk_recurring_reminder
    CHECK (
      reminder_offset_minutes IS NULL
      OR reminder_offset_minutes >= 0
    ),

  CONSTRAINT chk_recurring_end_date
    CHECK (
      end_date IS NULL
      OR end_date >= start_date
    ),

  KEY idx_recurring_tasks_active_next (active, next_run_at),
  KEY idx_recurring_tasks_farm (farm_id),
  KEY idx_recurring_tasks_field (field_id),
  KEY idx_recurring_tasks_category (category_id),
  KEY idx_recurring_tasks_created_by (created_by)
);
