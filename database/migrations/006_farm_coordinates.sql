-- FarmFlow — farm coordinates for weather (Phase 14)
-- Applied via the migration runner in backend/src/database/migrate.ts

ALTER TABLE farms
  ADD COLUMN latitude DECIMAL(9, 6) AFTER location,
  ADD COLUMN longitude DECIMAL(9, 6) AFTER latitude;