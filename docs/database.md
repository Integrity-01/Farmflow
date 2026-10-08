# FarmFlow Database

## Engine

MariaDB (10.4+, MySQL-compatible). The API also talks to a plain MySQL server
without changes. Migrations in `database/migrations/` are applied in filename
order by `npm run migrate` (runner: `backend/src/database/migrate.ts`, using
`mysql2`) and tracked in the `schema_migrations` table. Never edit an applied
migration — create a new one.

## Schema overview

| Table | Purpose |
| --- | --- |
| `users` | Accounts, roles, credentials (hashed) |
| `farms` | Farms, location, size, manager, status |
| `fields` | Fields within farms, crop, planting/harvest dates |
| `workers` | Field workers, skills, status, linked farm/field |
| `task_categories` | Activity categories (system + custom) |
| `tasks` | Task details, status, priority, deadline, progress |
| `task_comments` | Comments on tasks |
| `task_attachments` | Photos/documents/PDFs per task |
| `task_history` | Append-only audit trail per task |
| `notifications` | In-app notification messages |
| `notification_preferences` | Per-user notification toggles |
| `push_subscriptions` | Browser web-push subscriptions |
| `reports` | Generated report records |

## Key design decisions

- **IDs:** `VARCHAR(36)` with `DEFAULT (UUID())` (server-generated UUIDs; the
  app also generates them explicitly via `crypto.randomUUID()`).
- **Timestamps:** `DATETIME` (no timezone); local timezone interpretation is an
  API-layer concern. The configured `APP_TIMEZONE` guides deadline
  calculations.
- **Booleans:** `TINYINT(1)` (`0`/`1`); the adapter coerces column values to
  real booleans on read.
- **Arrays / JSON:** stored as JSON `TEXT` columns (e.g. `workers.skills`,
  `recurring_tasks.weekdays`, `task_history` values, `reports.filters`), JSON
  stringified on write and parsed by the adapter on read.
- **Task status vs deadline status:** `tasks.status` stores only the three
  primary states (`todo`, `in_progress`, `finished`). Deadline state
  (`on_track` / `due_soon` / `due_today` / `overdue` / `completed`) is
  **derived** from `deadline_at` + `status` at query time — never persisted, so
  it cannot drift.
- **Reminder state:** `reminder_offset_minutes` (how soon before the deadline to
  remind) and `reminder_sent_at` (dedupe guard) on `tasks`.
- **Audit trail:** `task_history` is append-only. There is no UPDATE path in the
  API; ordinary users cannot modify history.
- **Indexes:** composite indexes target the hot query shapes: dashboard counts
  (`status, deadline_at`), worker lists (`assigned_to, status`), notification
  inbox (`user_id, is_read, created_at DESC`).

## Enums

MySQL `ENUM` types: `user_role`, `task_status`, `task_priority`, `farm_status`,
`field_status`, `worker_status`, `notification_type`, `report_format`.

## Migration files

```
database/migrations/
└── 001_initial_schema.sql   # tables, ENUMs, seed categories (INSERT IGNORE)
└── 002_auth_session.sql     # refresh-session handling
└── 003_recurring_tasks.sql  # recurring_tasks schedules
```

No database triggers are used (the driver cannot execute `DELIMITER` blocks);
`updated_at` is set explicitly by the services on every UPDATE.