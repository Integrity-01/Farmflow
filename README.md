# FarmFlow 🌱

**Farm Tasks. People. Progress. Simplified.**

FarmFlow is a mobile-first Progressive Web App for farms, agricultural
organizations, farm managers, supervisors and field workers to manage daily
farm activities, workers, farms, fields, deadlines, progress, notifications,
reports and operational history.

It feels like Asana / Trello / Monday.com, but built specifically for
agricultural operations — simple workflow, friendly UI, reliable task tracking
and timely notifications, with Excel/CSV import & export for organizations that
still live in spreadsheets.

---

## Features

- Farms, fields, workers and task categories
- Inventory & inputs (seeds, fertilizer, fuel…) with low-stock alerts and a
  stock movement trail
- Weather: current conditions and a 7-day forecast per farm (set farm
  coordinates when creating or editing a farm)
- Tasks with priorities, deadlines, progress and reminders
- Kanban workflow: **To Do → In Progress → Finished**
- Independent deadline monitoring (On Track, Due Soon, Due Today, Overdue,
  Completed) — task status and deadline status never mix
- In-app, browser push and email notifications plus a notification center
- Role-based access: Administrator, Farm Manager, Supervisor, Field Worker
- Dashboard with statistics and activity feed
- Worker & farm performance analytics
- Reports with Excel/CSV/PDF export
- Excel/CSV import with validation preview
- PWA: installable, offline-capable with sync queue (progressive rollout)
- AI assistant (OpenAI, opt-in): ask questions about your farm or generate
  suggested tasks — degrades cleanly until `OPENAI_API_KEY` is set
- Full audit trail for every task

## Technology stack

- **Frontend:** React 19, TypeScript, Vite 7, Tailwind CSS 4, Zustand,
  TanStack Query, React Router, Lucide icons, shadcn-style component system
- **Backend:** Node.js, Express 5, TypeScript, Zod, node-cron, mysql2
- **Database:** MariaDB / MySQL 10.4+ (relational schema + migrations)
- **PWA:** Web App Manifest, service worker, offline fallback, push notifications
- **Email:** provider-agnostic abstraction (SMTP, Resend, SendGrid, SES)

## Project structure

```
farmflow/
├── public/            # static assets: icons, manifest, sw.js, offline.html
├── src/               # React frontend
│   ├── components/    # ui/ (design system), layout/, feature components
│   ├── pages/         # route pages
│   ├── hooks/         # shared hooks
│   ├── services/      # API client etc.
│   ├── store/         # zustand client state
│   ├── pwa/           # service worker registration
│   ├── types/         # shared TypeScript types
│   └── utils/         # helpers (cn, etc.)
├── backend/           # Express API
│   └── src/
│       ├── config/    # env validation
│       ├── controllers/
│       ├── routes/
│       ├── services/  # business logic lives here
│       ├── jobs/      # background jobs (deadlines, reminders)
│       ├── middleware/
│       └── database/  # mysql2 pool + migration runner
├── database/
│   └── migrations/    # SQL migrations
├── docs/              # architecture, database, api, pwa, deployment
└── scripts/           # tooling (PWA icon generation)
```

## Prerequisites

- Node.js 20+ (24 recommended)
- npm 10+
- MySQL / MariaDB 10.4+ (for full functionality)

## Installation

```bash
git clone <repo-url> farmflow
cd farmflow
npm install
```

## Environment variables

Copy the example file and fill in real values:

```bash
cp .env.example .env
```

Key variables (see `.env.example` for the full list):

| Variable | Description |
| --- | --- |
| `DB_HOST` | Database host (default `localhost`) |
| `DB_PORT` | Database port (default `3306`) |
| `DB_USER` | Database user (default `root`) |
| `DB_PASSWORD` | Database password |
| `DB_NAME` | Database name (default `farmflow`) |
| `DATABASE_URL` | Optional legacy URL form override (`mysql://…`) |
| `JWT_SECRET` | Secret for signing auth tokens (min 32 chars) |
| `PORT` | API port (default `4000`) |
| `CORS_ORIGIN` | Comma-separated allowed frontend origins |
| `API_PROXY_TARGET` | Dev proxy target for Vite |
| `VITE_API_URL` | Optional full API base URL for the frontend (empty = use proxy) |
| `EMAIL_*` | Email provider settings |
| `VAPID_*` | Web-push keys |
| `OPENAI_API_KEY` | Used only by the opt-in AI features (Phase 15) |

Never commit `.env` — it is gitignored.

## Database setup

```bash
# 1. Create the database (MariaDB/MySQL)
mysql -u root -e "CREATE DATABASE IF NOT EXISTS farmflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

# 2. Run migrations (creates tables, enums, seed categories)
npm run migrate
```

Migrations live in `database/migrations/`. Each new file is applied once and
tracked in `schema_migrations`.

## Development

Start both the API and the web dev server:

```bash
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000 (`/api/health` for status)

Or run them separately:

```bash
npm run dev:web   # Vite dev server
npm run dev:api   # API with hot reload (tsx watch)
```

The Vite dev server proxies `/api/*` to the backend (`API_PROXY_TARGET`).

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run API + web together |
| `npm run build` | Build web + API for production |
| `npm run typecheck` | Type-check frontend and backend |
| `npm start:api` | Run the compiled API server |
| `npm run preview` | Preview the production web build |
| `npm run migrate` | Apply pending database migrations |
| `npm run icons` | Regenerate PWA icons from `scripts/generate-icons.mjs` |

## PWA

FarmFlow is an installable Progressive Web App:

- Web App Manifest at `/manifest.webmanifest`
- Service worker at `/sw.js` (precaches app shell, offline fallback, push
  notifications)
- Offline fallback page at `/offline.html`
- Install from the browser's address bar / install prompt on Android, iOS and
  desktop Chromium

Offline-first data synchronization and background sync are added incrementally
(see `docs/pwa.md`).

## Testing

Test suites are introduced alongside each feature phase and run with:

```bash
npm test            # full suite
```

Covered areas: auth, authorization, task status transitions, deadline and
reminder calculations, notifications, reports, Excel import/export, offline sync
and the AI confirmation workflow.

## Deployment

See `docs/deployment.md`. High-level topology:

```
Frontend (static)  →  Backend API  →  MariaDB / MySQL
                       ↓  ↓  ↓
                Object storage · Email · Push · OpenAI
```

All secrets live in environment variables. The frontend is a static build
(`dist/`) that can be served by any static host; the API is a Node service.

## API documentation

See `docs/api.md`. Swagger/OpenAPI spec is generated as endpoints are added.

## Contributing

1. Follow the architecture in `docs/architecture.md`.
2. Keep business logic in `backend/src/services`, not in route definitions.
3. Keep database access in services, not controllers.
4. Add a migration for schema changes; never edit applied migrations.
5. Validate on both client and server; friendly messages only.
6. Add loading, empty and error states to every async surface.
7. Never expose secrets in frontend code.
8. AI features must never bypass permissions or operate without confirmation.

## License

Proprietary. All rights reserved.