#!/bin/sh
# ---------------------------------------------------------------------------
# Runs every time the API container starts. We apply any pending database
# migrations FIRST (idempotent — does nothing if the DB is already up to date),
# then hand off to the Node server.
#
# `migrate deploy` is the production-safe command: it only applies committed
# migration files and never generates new ones or prompts (unlike `migrate dev`).
# Doing it here means a fresh database (or a new migration in a deploy) is
# brought up to schema automatically before the app serves traffic.
# ---------------------------------------------------------------------------
set -e

echo "→ Applying database migrations (prisma migrate deploy)…"
./node_modules/.bin/prisma migrate deploy

echo "→ Starting API…"
exec node dist/main.js
