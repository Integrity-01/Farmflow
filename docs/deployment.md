# FarmFlow Deployment

## Topology

```
Static frontend (dist/) ──────► HTTPS
Express API (Node) ───────────► HTTPS
      │
      ├── MariaDB / MySQL
      ├── Object storage (uploads)
      ├── Email provider (SMTP / Resend / SendGrid / SES)
      ├── Push notification service (VAPID)
      └── OpenAI API (optional, server-side only)
```

All secrets are environment variables. Nothing sensitive reaches the browser.

## Required environment variables

```
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://app.example.com
DATABASE_URL=…               # optional legacy; DB_* vars take precedence
DB_HOST=db.example.com
DB_PORT=3306
DB_USER=farmflow
DB_PASSWORD=<strong password>
DB_NAME=farmflow
JWT_SECRET=<long random string>
EMAIL_PROVIDER=smtp|resend|sendgrid|ses
EMAIL_API_KEY=...
EMAIL_FROM=FarmFlow <no-reply@example.com>
# SMTP only (EMAIL_PROVIDER=smtp):
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false          # true for 465
EMAIL_USER=smtp-username
EMAIL_PASS=smtp-password
APP_URL=https://app.example.com
STORAGE_URL=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
OPENAI_API_KEY=...        # optional
```

## Build

```bash
npm install
npm run build       # -> dist/  (web)  and  backend/dist/  (api)
npm run migrate     # apply DB migrations
```

Web output: `dist/` (static). API output: `backend/dist/` started with
`npm run start:api`.

## Frontend hosting

Serve `dist/` from any static host (Nginx, Caddy, Netlify, Cloudflare Pages,
S3/CDN...). Requirements for the PWA:

- HTTPS
- `Content-Type` correct for `.webmanifest`
- SPA fallback: unknown paths → `index.html`
- Service worker scope `/` (no far-future cache headers that break WS updates)

Set `VITE_API_URL` at build time to the API origin, or reverse-proxy `/api`.

## API hosting

Node 20+ process. Run with a process manager (systemd, pm2) and:

- `NODE_ENV=production`
- Reverse proxy Nginx/Caddy for TLS termination
- `HELMET` + `CORS_ORIGIN` restricted to your domain
- MariaDB/MySQL managed, automated backups (daily + binlog)
- Migrations run in deploy as a release step

## Background jobs

Deadline monitoring, reminders and daily summaries run inside the API process
(node-cron). Run one primary replica for these jobs to avoid duplicate
notifications.

## Monitoring & errors

- Health probe: `GET /api/health` (liveness + DB readiness).
- Structured JSON logs (single line per event) for log shipping.
- Production error logging captured via the centralized error handler.
- Backups: `mysqldump` scheduled; test restore process.

## Scaling notes

- Horizontal scale: stateless API behind a load balancer except background jobs
  (pin to one replica).
- Read heat on dashboards/reports → add indexes, then read replicas/caching.
- Uploads → object storage directly via presigned URLs (Phase 6+).