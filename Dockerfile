# FarmFlow multi-stage Docker build.
#
# Targets:
#   api  - Node API runtime (compiled JS, prod deps only), runs migrations on start
#   web  - static web build served by Nginx, SPA fallback + PWA-safe cache headers
#
# Secrets must never be baked in: .env is docker-ignored and passed at runtime
# via docker compose env_file/environment.

# syntax=docker/dockerfile:1

# ---- Build stage: install everything, compile API (tsc) + web (vite) ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
RUN npm ci
COPY . .
RUN npm run build:api && npm run build:web

# ---- Prod deps: keep only runtime dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
RUN npm ci --omit=dev

# ---- API runtime stage ----
FROM node:22-alpine AS api
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/backend/node_modules /app/backend/node_modules
COPY --from=build /app/backend/dist /app/backend/dist
COPY --from=build /app/database/migrations /app/database/migrations
RUN mkdir -p /app/backend/uploads /app/backend/reports
EXPOSE 4000
# Migrations are idempotent (schema_migrations table); run them before boot.
CMD ["sh", "-c", "node dist/database/migrate.js && node dist/server.js"]

# ---- Web runtime stage (static files) ----
FROM nginx:1.27-alpine AS web
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80