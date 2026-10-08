# FarmFlow Architecture

## Overview

FarmFlow is a two-tier web application:

```
Web App (React SPA / PWA)
        │  HTTPS + JSON
        ▼
Express API (Node.js / TypeScript)
        │  mysql2
        ▼
MariaDB / MySQL
```

The frontend is a static build served by any static host (or Vite dev server in
development). It talks to the backend exclusively through the REST API under
`/api`. In development, Vite proxies `/api` to `localhost:4000`; in production,
point `VITE_API_URL` at the API origin.

## Backend layering

```
routes/          → thin HTTP wiring, no business logic
controllers/     → translate HTTP <-> services (parse, validate, respond)
services/        → business logic and database access
jobs/            → scheduled background work (node-cron)
middleware/      → auth, validation, errors, logging, rate limiting
config/          → validated environment configuration
database/        → mysql2 pool + migration runner
```

Services write SQL once; `database/pool.ts` translates a small PostgreSQL
compatibility surface to MySQL/MariaDB at runtime (`$n` → `?`, drops `::cast`,
`ILIKE` → `LIKE`, `TRUE`/`FALSE` → `1`/`0`, strips `ON CONFLICT ... DO
NOTHING`) and coerces boolean/TINYINT and JSON-as-TEXT columns on read.

Rules enforced by design:

- Controllers never build SQL; services own all business logic.
- Route definitions never contain logic beyond middleware + controller calls.
- All environment configuration is validated at boot (`config/env.ts`), so a
  misconfigured server fails fast with a clear message.
- Every protected endpoint must verify authorization server-side; frontend role
  checks are cosmetic only.

## Frontend layering

```
pages/           → route-level screens
components/      → ui/ (design-system atoms) + layout/ + feature components
hooks/           → shared reactive logic (data fetching, etc.)
services/        → API client (src/services/api.ts)
store/           → zustand client state (connection, UI state)
types/           → shared types
utils/           → generic helpers (cn etc.)
pw-a/            → service worker registration
```

State management split:

- **Server state** (tasks, workers, farms, notifications) → TanStack Query,
  cached by query key, single source of truth after fetch.
- **Client state** (sidebar collapsed, online status, filters in-flight) →
  Zustand.

## Error handling

- Backend: `AppError` carries `statusCode` + machine-readable `code`. Zod
  validation errors map to `400 VALIDATION_ERROR` with per-field details. The
  final `errorHandler` always returns a JSON payload with a human-friendly
  `message` — never a raw stack trace.
- Frontend: `api.get/post/...` wrap network failures and server errors in
  `ApiError` with friendly messages. Pages render loading (skeleton), empty and
  error states.

## Deadline engine (background, not browser)

Critical time-sensitive work — deadline monitoring, reminders, overdue
detection, daily summaries, recurring-task generation — runs in
`backend/src/jobs/` via node-cron. It never depends on a user's browser being
open. Recurring rules are expanded into real task instances by
`recurring.service.processDue()` on a 5-minute cron and advanced occurrence by
occurrence through each rule's `next_run_at`.

Notifications fan out through the same services regardless of channel: the
in-app row is inserted, a web push is attempted, and (where the recipient's
email preferences allow) a transactional email is sent by
`email.service.sendToUser()` using HTML templates from
`services/email/templates.ts`. Sends are fire-and-forget; with no SMTP
provider configured the API logs a warning plus the rendered body instead.
The `30 6 * * *` job computes each user's last-7-days summary (in
`APP_TIMEZONE`) and emails it to users with the daily-summary preference on.

## Security model

- Passwords are hashed server-side (bcrypt). No plaintext storage.
- JWT sessions with `JWT_SECRET` environment variable.
- Helm secure headers, CORS allow-list, express-rate-limit on `/api`.
- Input validation with Zod on every endpoint.
- Parameterized SQL (mysql2) throughout → no SQL injection surface.
- File uploads validated by content, not extension.
- Secrets only in `.env` (gitignored); nothing secret is ever shipped to the
  browser.