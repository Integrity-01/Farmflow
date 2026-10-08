-- FarmFlow — microsecond timestamps on stock movements (Phase 13)
-- Applied via the migration runner in backend/src/database/migrate.ts

-- A single table can log several adjustments within the same second; DATETIME(6)
-- keeps movement ordering deterministic.
ALTER TABLE input_movements
  MODIFY COLUMN created_at DATETIME(6) NOT NULL DEFAULT now(6);