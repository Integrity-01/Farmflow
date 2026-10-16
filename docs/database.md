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
| `organizations` | Organizations (tenants) + join `settings` JSON |
| `organization_memberships` | User ↔ organization membership, role, status |
| `organization_invitations` | Pending invitations (email + role, expiring token) |
| `roles` / `permissions` / `role_permissions` | Role codes and DB-backed permission grants |
| `access_keys` | Hashed organization join keys (revocable) |
| `sessions` | Refresh sessions; `active_organization_id` is the only FK |
| `administrator_login_credentials` | Admin ID ↔ user + organization mapping (`status` active/disabled) |
| `audit_logs` | Append-only security/administrative event log |

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
- **Administrator Admin IDs:** `administrator_login_credentials` maps a unique
  `admin_id` (format `FF-ADM-XXXX-XXXX`, unambiguous alphabet) to a `user_id`
  + `organization_id` pair, with `UNIQUE (admin_id)` and
  `UNIQUE (user_id, organization_id)`. The identifier is stored in the clear
  (it is a login name, not a secret); the account's password hash lives on
  `users` and is verified with bcrypt. Rows are added when an organization is
  created or a member is promoted to `organization_administrator`, and marked
  `disabled` when the role/status changes. Existing administrators can be
  backfilled with `npm run backfill:admin-ids -w backend`.
- **Security audit log:** `audit_logs` records administrative/security events
  (`organization.created`, `admin.login`, `member.updated`, `member.removed`,
  `access_key.rotated`, `admin_credential.enrolled`, `password.reset`) with an
  optional actor, organization, target and JSON `metadata`. Never store secrets
  in `metadata`.
- **Indexes:** composite indexes target the hot query shapes: dashboard counts
  (`status, deadline_at`), worker lists (`assigned_to, status`), notification
  inbox (`user_id, is_read, created_at DESC`).

## Enums

MySQL `ENUM` types: `user_role`, `task_status`, `task_priority`, `farm_status`,
`field_status`, `worker_status`, `notification_type`, `report_format`.

## Migration files

```
database/migrations/
├── 001_initial_schema.sql          # tables, ENUMs, seed categories (INSERT IGNORE)
├── 002_auth_session.sql            # refresh-session handling
├── 003_recurring_tasks.sql         # recurring_tasks schedules
├── 004_inventory_inputs.sql        # inventory items & input movements
├── 005_input_movements_precision.sql
├── 006_farm_coordinates.sql
├── 007_harvest_category_names.sql
├── 009_organizations.sql           # organizations, memberships, invitations, keys, roles
├── 010_role_codes.sql              # role codes + permission grants
├── 011_session_active_org.sql      # sessions.active_organization_id
└── 012_admin_credentials_and_audit.sql  # Admin IDs + audit_logs
```

Note: there is no `008_*` migration (the number was reserved and skipped; the
runner only requires ascending, zero-padded names).

No database triggers are used (the driver cannot execute `DELIMITER` blocks);
`updated_at` is set explicitly by the services on every UPDATE.