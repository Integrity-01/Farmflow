-- FarmFlow — inventory inputs & stock movements (Phase 13)
-- Applied via the migration runner in backend/src/database/migrate.ts

-- ============================================================
-- Inputs
-- ============================================================
CREATE TABLE IF NOT EXISTS inputs (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  farm_id VARCHAR(36) NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type ENUM('seed', 'fertilizer', 'pesticide', 'herbicide', 'fungicide', 'feed', 'fuel', 'equipment', 'tools', 'other') NOT NULL DEFAULT 'other',
  unit VARCHAR(30) NOT NULL DEFAULT 'unit',
  quantity DECIMAL(12, 2) NOT NULL DEFAULT 0,
  low_stock_threshold DECIMAL(12, 2) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12, 2),
  supplier VARCHAR(120),
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT now(),
  updated_at DATETIME NOT NULL DEFAULT now(),
  UNIQUE KEY uq_inputs_farm_name (farm_id, name),
  KEY idx_inputs_farm (farm_id),
  KEY idx_inputs_type (type)
);

-- ============================================================
-- Input movements
-- ============================================================
CREATE TABLE IF NOT EXISTS input_movements (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  input_id VARCHAR(36) NOT NULL REFERENCES inputs(id) ON DELETE CASCADE,
  qty_change DECIMAL(12, 2) NOT NULL,
  note VARCHAR(255),
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME NOT NULL DEFAULT now(),
  KEY idx_input_movements_input (input_id),
  KEY idx_input_movements_created_by (created_by)
);