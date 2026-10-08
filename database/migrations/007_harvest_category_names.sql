-- FarmFlow — task category naming (Harvest + Other always present)
-- Applied via the migration runner in backend/src/database/migrate.ts

UPDATE task_categories SET name = 'Harvest' WHERE name = 'Harvesting' AND is_system = 1;

INSERT IGNORE INTO task_categories (name, icon, is_system) VALUES ('Other', 'other', 1);