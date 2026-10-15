# FarmFlow API

Base path: `/api`. JSON request/response bodies. Authenticated endpoints use a
bearer access token; a rotating refresh token is held in the `ff_refresh`
httpOnly cookie (7-day lifetime).

## Conventions

- **Success:** `2xx` with the resource payload directly.
- **Error:** JSON envelope:

```json
{
  "status": "error",
  "code": "VALIDATION_ERROR",
  "message": "Please correct the highlighted fields.",
  "details": [{ "path": "deadline_at", "message": "Please choose a valid deadline." }]
}
```

- **Codes** are stable and machine-readable: `VALIDATION_ERROR`, `NOT_FOUND`,
  `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED`, `EMAIL_TAKEN`,
  `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`, `INVALID_RESET_TOKEN`,
  `INTERNAL_ERROR`, `NETWORK_ERROR`/`REQUEST_TIMEOUT` (client).

## Endpoints (current)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api` | — | API metadata |
| GET | `/api/health` | — | Liveness + database readiness |
| POST | `/api/auth/verify-organization-key` | — | Verify an organization key before authentication |
| POST | `/api/auth/register` | — | Create an account in the verified organization |
| POST | `/api/auth/login` | — | Sign in to the verified organization |
| POST | `/api/auth/organizations` | — | Create an organization, administrator account, and initial key |
| POST | `/api/auth/refresh` | — | Rotate session using `ff_refresh` cookie |
| POST | `/api/auth/logout` | — | Revoke session, clear cookie |
| GET | `/api/auth/me` | Bearer | Current user profile |
| POST | `/api/auth/forgot-password` | — | Send password reset email |
| POST | `/api/auth/reset-password` | — | Set new password from reset token |
| GET | `/api/organizations/settings` | Bearer | New-member join settings (admin) |
| PATCH | `/api/organizations/settings` | Bearer | Update `selfJoin` / `defaultRole` (admin) |
| GET | `/api/farms` | Bearer | List farms (role-aware, filtered/paginated) |
| GET | `/api/farms/managers` | Bearer | Active farm managers & admins |
| POST | `/api/farms` | Bearer+ | Create a farm |
| GET | `/api/farms/:id` | Bearer | Farm detail incl. fields |
| PATCH | `/api/farms/:id` | Bearer+ | Update a farm |
| DELETE | `/api/farms/:id` | Bearer+ | Delete a farm (blocks if open tasks) |
| GET | `/api/farms/:id/fields` | Bearer | List a farm's fields |
| POST | `/api/farms/:id/fields` | Bearer+ | Add a field |
| PATCH | `/api/farms/fields/:fieldId` | Bearer+ | Update a field |
| DELETE | `/api/farms/fields/:fieldId` | Bearer+ | Delete a field |
| GET | `/api/workers` | Bearer | List workers (role-aware, filtered/paginated) |
| GET | `/api/workers/:id` | Bearer | Worker detail |
| POST | `/api/workers` | Bearer+ | Create a worker |
| PATCH | `/api/workers/:id` | Bearer+ | Update a worker |
| DELETE | `/api/workers/:id` | Bearer+ | Delete a worker |
| GET | `/api/categories` | Bearer | Task categories |
| GET | `/api/tasks` | Bearer | List tasks (role-aware, filtered/paginated) |
| GET | `/api/tasks/:id` | Bearer | Task detail incl. comments & attachments |
| POST | `/api/tasks` | Bearer++ | Create a task |
| PATCH | `/api/tasks/:id` | Bearer++ | Update a task |
| DELETE | `/api/tasks/:id` | Bearer++ | Delete a task |
| POST | `/api/tasks/:id/start` | Bearer | Mark a task in-progress |
| POST | `/api/tasks/:id/complete` | Bearer | Mark a task finished |
| POST | `/api/tasks/:id/comments` | Bearer | Add a comment |
| POST | `/api/tasks/:id/attachments` | Bearer | Upload a file (multipart `file`) |
| DELETE | `/api/tasks/attachments/:id` | Bearer | Remove an attachment |
| GET | `/api/notifications` | Bearer | List my notifications (paginated) |
| GET | `/api/notifications/unread-count` | Bearer | Unread notification count |
| PATCH | `/api/notifications/:id/read` | Bearer | Mark one notification read |
| POST | `/api/notifications/read-all` | Bearer | Mark all notifications read |
| GET | `/api/analytics` | Bearer | Role-scoped analytics summary (`rangeDays`) |
| GET | `/api/reports` | Bearer | List my generated reports (paginated) |
| POST | `/api/reports` | Bearer | Generate a CSV report (`tasks`/`workers`/`farms`) |
| DELETE | `/api/reports/:id` | Bearer | Delete a report you own (admins: any) |
| GET | `/api/history` | Bearer | List task activity (role-aware, filtered/paginated) |
| GET | `/api/push/vapid-public-key` | Bearer | The VAPID public key for browser subscriptions |
| POST | `/api/push/subscribe` | Bearer | Register/update a web-push subscription |
| POST | `/api/push/unsubscribe` | Bearer | Remove a web-push subscription |
| GET | `/api/settings/profile` | Bearer | My profile |
| PATCH | `/api/settings/profile` | Bearer | Update my name/phone |
| GET | `/api/settings/notifications` | Bearer | My notification preferences |
| PATCH | `/api/settings/notifications` | Bearer | Update notification preferences |
| POST | `/api/settings/change-password` | Bearer | Change my password (revokes all sessions) |

`Bearer+` = at least `farm_manager`; `Bearer++` = at least `supervisor`.
`POST /api/tasks/:id/start` / `complete` require the farm leader, the task
creator, or the assigned worker.

### Authentication

```http
POST /api/auth/verify-organization-key
Content-Type: application/json

{ "accessKey": "organization-key" }
```

```json
200
{
  "organization": {
    "id": "…", "name": "Green Valley Farms", "joinMode": "open"
  }
}
```

The key verification endpoint returns `{ organization: { id, name, joinMode } }`
where `joinMode` is `open` (registrations join immediately with the
organization's default role) or `approval` (registrations are created
`pending` and wait for an administrator). The key must be sent again with
account creation or sign-in and is checked against that organization by the
API — the key never replaces user credentials or grants privileged access on
its own. `POST /api/auth/organizations` creates the organization and its
administrator and returns an initial `accessKey` once for the
administrator to save/share.

The `Set-Cookie: ff_refresh=…` header carries the refresh session.

- Verify key: `400 INVALID_ACCESS_KEY` when the key is invalid, expired,
  revoked, or belongs to a suspended organization.
- Register: requires the matching `organizationId` and `accessKey`;
  `409 EMAIL_TAKEN` if the email exists. Password must be ≥ 8 chars
  (`400 VALIDATION_ERROR`). The membership is created `active` with the
  organization's default role when `joinMode` is `open`, or `pending` when it
  is `approval`. Rate limited to 5 accounts/hour/IP.
- Login: requires the matching `organizationId` and `accessKey`;
  `401 INVALID_CREDENTIALS`, `403 ACCOUNT_DISABLED`, or
  `403 ORGANIZATION_ACCESS_REQUIRED` (no membership at all). Memberships in
  `pending` state can sign in but are shown an approval-pending screen until
  an administrator activates them. Rate limited to 8 attempts/15 min/IP.
- Refresh: reads `ff_refresh`, rotates the refresh token and returns a new
  `accessToken` + `user`. `401 UNAUTHORIZED` when absent/expired/revoked.
- Logout: revokes the session server-side and clears the cookie (`204`).
- Forgot-password: always responds `200` (no account enumeration). When a
  provider is configured an email is sent (30 min expiry); in development the
  reset link is returned as `devResetLink`.

### Roles

`field_officer` < `supervisor` < `farm_manager` < `organization_administrator`,
plus administrator-created custom roles. Beyond the coarse route gate,
endpoints check DB-backed role permissions (e.g. `farm:create`,
`member:approve`); protected routes check the access token
(`401 UNAUTHORIZED` if invalid/expired, `403 FORBIDDEN` if the role is too low).
The first administrator is created explicitly with its organization; member
accounts receive their role through organization membership.

### Farms

`GET /api/farms` accepts `search`, `status` (`active|inactive|archived`),
`page`, `pageSize` (max 100) query params. Listing is role-aware:

- admins & managers see every farm; supervisors see farms they manage or are a
  worker on; field workers see farms they are assigned to.

Create/update/delete and field management require at least `farm_manager`, and
non-admin managers may only manage farms where `manager_id` is themselves.
`DELETE /api/farms/:id` returns `409 FARM_HAS_TASKS` when open tasks reference
the farm. Fields have a `UNIQUE (farm_id, name)` constraint (duplicate
`409 NAME_TAKEN`).

### Workers

`GET /api/workers` accepts `search` (name/phone/email), `status`
(`active|inactive|suspended`), `farmId`, `page`, `pageSize` (max 100).
Listing is role-aware:

- admins & managers see every worker; supervisors see workers on the farms they
  manage or are a worker on; field workers only see their own record.

Creating, updating and deleting require at least `farm_manager`; non-admin
managers may only manage workers placed on farms they manage (`403 FORBIDDEN`
otherwise). A field must belong to the worker's farm when both are set
(`400 INVALID_REFERENCE`). `DELETE /api/workers/:id` returns
`409 WORKER_HAS_TASKS` (open tasks) — reassign or set the worker inactive
instead.

### Tasks

`GET /api/tasks` accepts `search`, `status` (`todo|in_progress|finished`),
`priority` (`low|medium|high|critical`), `farmId`, `fieldId`, `categoryId`,
`assignedTo`, `mine`, `overdue`, `page`, `pageSize` (max 100). Visibility:

- admins & managers see every task; supervisors see tasks on the farms they
  manage or are a worker on; field workers see tasks assigned to them.

Creating, updating and deleting require at least `supervisor`, and the user must
lead the task's farm (admin, the farm's `manager_id`, or a supervisor placed as
a worker on that farm). Assigning requires an active worker; a field must belong
to the farm. `progress` accepts `0..100` — setting `100` finishes the task and
records `completed_at`; setting a lower value on a finished task reopens it.
`POST /tasks/:id/start` stamps `start_at`; `POST /tasks/:id/complete` records
`completed_at`, `actual_duration_minutes` and sets progress to 100.

Comments (`POST /tasks/:id/comments`) are available to anyone who can view the
task. Attachments upload via multipart `file` (max 15 MB, stored under
`/uploads/`) and are removable by leaders, the uploader, or the task creator.
Assignment and completion create in-app notifications and an append-only
`task_history` audit trail.

### Notifications

Notifications belong to the current user (`GET /api/notifications` accepts
`unreadOnly`, `page`, `pageSize`). `unread-count` powers badge indicators in the
app shell. `PATCH /:id/read` and `POST /read-all` mark items read and return the
new unread state. In-app rows are created on task assignment, completion,
comments, plus scheduled sweeps (every 15 min overdue, every 5 min due-within-an-hour)
which insert `task_overdue`/`task_due_soon` rows and stamp the task's
`overdue_notified_at`/`reminder_sent_at`.

### Analytics

`GET /api/analytics?rangeDays=30` (roles: `farm_manager`+) returns KPIs (total,
open, finished, overdue, completion rate) plus breakdowns by status, priority,
farm, category and worker, and lists of upcoming deadlines and recent tasks.
The scope is role-aware, matching what the caller can see in the rest of the
app (admins/managers: everything; supervisors: their farms; field workers:
their own tasks). `rangeDays` is `0` for all time.

### Reports

`POST /api/reports` (roles: `farm_manager`+) generates CSV exports for
`tasks`, `workers` or `farms`, with optional `filters` (`farmId`, `status`,
`rangeDays`). Generation is synchronous; a `reports` row is recorded as
`completed` with `file_url` (served under `/reports/`) or `failed` with an
`error_message`. Invalid formats are rejected with `VALIDATION_ERROR` (CSV only
today). `GET /api/reports` lists the caller's own reports (admins see all);
`DELETE /api/reports/:id` is limited to the owner or an admin and removes the
stored file too.

### History

`GET /api/history` (roles: `farm_manager`+) lists the append-only `task_history`
audit trail, newest first. Accepts `search` (task title), `action`
(`created|updated|status_changed|assigned|started|completed|reopened|progress_changed|deadline_changed|priority_changed|comment_added|attachment_added|attachment_removed`),
`farmId`, `page`, `pageSize`. Scope is role-aware (admins/managers: everything;
supervisors: their farms; field workers: their own tasks). Unknown `action`
values are ignored rather than rejected, so new events keep the endpoint
backward-compatible.

### Recurring tasks

`/api/recurring-tasks` (roles: `supervisor`+, matching task placement rules:
admin, the farm's `manager_id`, or a supervisor placed as a worker on that
farm). A rule describes a schedule that the background job (5-minute cron)
realizes into real task instances.

- `GET /api/recurring-tasks` — list every rule, newest first, with joined
  farm/field/category/assignee names.
- `POST /api/recurring-tasks` — create a rule. Fields: `title`,
  `description`, `farmId`, optional `fieldId`, `categoryId`, optional
  `assignedTo` (active worker), `priority` (default `medium`), `frequency`
  (`daily|weekly|monthly`, default `weekly`), `intervalCount` (default `1`),
  `weekdays` (`0..6` int array, weekly), `dayOfMonth` (`1..28`, monthly,
  required), `startTimeMinutes` (minutes from midnight, default `420`),
  `estimatedDurationMinutes`, `reminderOffsetMinutes`, `startDate`
  (`YYYY-MM-DD`, required), optional `endDate`, `active` (default `true`).
- `GET /api/recurring-tasks/:id` — a single rule.
- `PATCH /api/recurring-tasks/:id` — partial update (same fields). Changing
  `startDate` or from a past date re-anchors the schedule on the new start.
- `DELETE /api/recurring-tasks/:id` — removes the rule; generated tasks stay.
- `POST /api/recurring-tasks/:id/activate` / `pause` — toggle `active`.
- `POST /api/recurring-tasks/:id/skip-next` — sets `skip_next`; the next
  occurrence is consumed without creating a task.
- `POST /api/recurring-tasks/:id/generate` — manually cause the next occurrence:
  `{ rule, task, skipped }`, where `task` is `null` when the occurrence was
  skipped or the schedule produced none. Generating while paused returns `409`.

Semantics: daily adds `intervalCount` days; weekly filters the set window on
`weekdays` (starts the Monday of the week containing `startDate`); monthly uses
`dayOfMonth` clamped to the target month's length. Occurrences are evaluated
server-local. `next_run_at` is stored per rule and advanced as tasks are
generated; occurrences older than 30 days are fast-forwarded without creating a
task, and a rule whose end date has passed is deactivated automatically. Each
generated task is `todo` with `progress: 0`, records `history` `created` with
`recurring: true`, is assigned by the rule's creator, and notifies the assignee
(in-app + push).

### Web push

Push delivery uses VAPID keys from `.env` (`VAPID_PUBLIC_KEY` /
`VAPID_PRIVATE_KEY`; without them sends are silently skipped). Clients fetch
`GET /api/push/vapid-public-key`, subscribe via the browser Push API, then
`POST /api/push/subscribe` with `{ endpoint, keys: { p256dh, auth } }`
(upserted per endpoint). `POST /api/push/unsubscribe` takes `{ endpoint }`.

Every in-app notification also attempts a web push to the recipient's active
subscriptions, gated by the user's `pushEnabled` preference and the per-type
toggle (assignments, deadline reminders, overdue alerts, completions, daily
summary). Delivery is fire-and-forget: `404/410` responses prune the dead
subscription, everything else is logged and ignored so a failed push never
breaks the task flow. The payload carries `title`, `body`, a deep-link `url`
(`/tasks?task=…` for task events) and `taskId`; the service worker tags
notifications per task and skips the banner when an app window is already
focused.

### Email

Transactional email runs alongside in-app notifications and is gated by the
same per-user preferences: the master `emailEnabled` toggle plus a per-type
toggle (`taskAssignments`, `deadlineReminders`, `overdueAlerts`,
`taskCompletions`, `dailySummary`; comments always follow the assignment
toggle). Delivery is fire-and-forget — a failing send is logged and never
breaks the task flow.

Provisioning is via `.env`: `EMAIL_PROVIDER=smtp` with `EMAIL_HOST`,
`EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS` and `EMAIL_FROM`.
Without a configured provider, sends are skipped with a `WARN` plus a logged
HTML body preview, so the pipeline is testable before credentials exist.
`APP_URL` (frontend origin) is used for deep links (`/tasks?task=…`).

Templates: welcome, password reset, task assigned, due-soon/deadline
reminder, overdue, task completed, new comment, and a daily summary. The
daily summary aggregates the last 7 days for tasks a user created or is
assigned to (per APP_TIMEZONE) and is sent by the `30 6 * * *` job only to
users with `dailySummary` enabled.

### Settings

Profile endpoints (`GET/PATCH /api/settings/profile`) and notification
preferences (`GET/PATCH /api/settings/notifications`) are available to any
authenticated user. `PATCH /profile` accepts `name` and optional `phone`.
Preferences cover channels (`emailEnabled`, `pushEnabled`, `inAppEnabled`) and
alerts (`taskAssignments`, `deadlineReminders`, `overdueAlerts`,
`taskCompletions`, `dailySummary`); rows are upserted per user. `POST
/settings/change-password` verifies `currentPassword`, updates the hash and
revokes every session for that user (the client must sign in again).

## Planned resources (Phases 10+)

```
JWT what remains: web-push delivery (VAPID)
```

Recurring tasks (`/recurring-tasks`, Phase 12), inventory/inputs
(`/inventory`, Phase 13), weather (`/weather`, Phase 14) and the AI
assistant (`/ai`, Phase 15) are implemented.

## AI assistant (Phase 15)

All `/ai` endpoints require `farm_manager+`. When `OPENAI_API_KEY` is not
set in `.env`, `GET /ai/status` reports `{ configured: false }` and
`POST /ai/chat` / `POST /ai/suggest` respond `501 AI_NOT_CONFIGURED` — the
feature degrades gracefully until a key is added and the API restarted.
Requests use `gpt-4o-mini` via the OpenAI Chat Completions API (no SDK
dependency, 30s timeout).

`GET /ai/status` — `{ configured: boolean }`.

`POST /ai/chat` — body `{ message, history? }` where `history` is an array
of `{ role: 'user'|'assistant', content }` (max 12). The assistant receives
a compact snapshot of the caller's farms: open tasks with priority/deadline/
assignee, low or out-of-stock inputs, farm field/worker counts, locations
and live weather for up to three farms with coordinates. Returns
`{ reply }`.

`POST /ai/suggest` — optional body `{ farmId }` to scope suggestions to one
farm. Returns `{ suggestions: [{ farmId, farmName, title, priority,
deadlineAt, rationale }] }` (3-6 items). `farmId` is cross-checked against
the caller's accessible farms (no hallucinated ids) and `priority` is
coerced to the known enum. Suggestion output is content only — creating the
task stays in the client via the normal task form.

## Weather (Phase 14)

`GET /weather/:farmId` — current conditions and a 7-day forecast for a farm,
proxied from Open-Meteo (no API key) and cached in-memory for 15 minutes.

Response:

```
{
  farm: { id, name, location, latitude, longitude },
  weather: {
    source: 'open-meteo',
    fetchedAt, current: { time, temperature, humidity, precipitation,
             windSpeed, code, condition, label },
    daily: [ { date, code, condition, label, tempMax, tempMin,
               precipitationSum, windSpeedMax } ]
  } | null,
  reason?: 'NO_COORDINATES' | 'UNAVAILABLE'
}
```

- `weather` is `null` with `reason: 'NO_COORDINATES'` when the farm has no
  latitude/longitude yet — farms expose optional `latitude`/`longitude`
  (validated to ±90/±180) on create and update.
- Network/provider failures degrade to `weather: null` + `reason:
  'UNAVAILABLE'` (HTTP 200) instead of a 500.
- WMO weather codes are mapped to a small `condition` enum (`clear`,
  `partly_cloudy`, `cloudy`, `fog`, `drizzle`, `rain`, `snow`,
  `thunderstorm`) with a human `label`.

## Inventory & inputs (Phase 13)

`/inventory` — farm-scoped stock of seeds, fertilizer, fuel and other inputs.

- `GET /inventory?search=&type=&stock=all|low|out&farmId=&page=&pageSize=`
  lists inputs (with `farmName`, `stock`, `lowStock`).
- `POST /inventory` creates an input (farm_manager+).
- `GET /inventory/:id` returns one input.
- `PATCH /inventory/:id` updates an input.
- `DELETE /inventory/:id` removes an input and its movements.
- `POST /inventory/:id/adjust` records a signed stock change (`change`)
  atomically with a movement; withdrawals past 0 return 400
  `INSUFFICIENT_STOCK`.
- `GET /inventory/:id/movements?page=&pageSize=` returns the movement trail
  (who, when, note).

Input type is a fixed enum: `seed`, `fertilizer`, `pesticide`, `herbicide`,
`fungicide`, `feed`, `fuel`, `equipment`, `tools`, `other`. Unit and farm are
validated on create.

## Rate limiting

Global `/api` limit: 300 requests / 15 min / IP. Stricter limits on auth
routes: register 5/h, login 8/15 min, forgot-password 5/h.

## Status codes

`200` OK · `201` Created · `204` No Content · `400` Bad Request ·
`401` Unauthorized · `403` Forbidden · `404` Not Found · `409` Conflict ·
`422` Unprocessable · `429` Too Many Requests · `500` Server Error