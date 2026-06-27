# syntax=docker/dockerfile:1
# ===========================================================================
# API image (NestJS). Multi-stage so the final image carries ONLY runtime
# files — no source, no dev dependencies, no pnpm store.
#
# Build context is the REPO ROOT (see docker-compose.prod.yml), because this
# app depends on the shared workspace package packages/contracts and on the
# root lockfile. You can't build a workspace app from just its own folder.
# ===========================================================================

# ---- base: the toolchain every stage shares -------------------------------
FROM node:22-slim AS base
# corepack ships with Node and lets us use the repo's pinned pnpm version.
# openssl is required by Prisma's query engine on debian-slim.
RUN corepack enable && \
    apt-get update && apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

# ---- build: install everything, generate Prisma client, compile -----------
FROM base AS build
# Copy ONLY manifests first. Docker caches this layer, so `pnpm install` re-runs
# only when a package.json or the lockfile changes — not on every code edit.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Now the sources.
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api

# Order matters: contracts (the dependency) builds first, then we generate the
# Prisma client (needed for the API to TYPE-CHECK), then compile the API.
RUN pnpm --filter @saas/contracts build && \
    pnpm --filter @saas/api exec prisma generate && \
    pnpm --filter @saas/api build

# `pnpm deploy` produces a SELF-CONTAINED folder at /app/out: the app's files
# plus a REAL, flat, production-only node_modules (the built @saas/contracts is
# copied in, not symlinked). This is the key to escaping pnpm's symlinks, which
# don't survive a cross-stage COPY.
# `--legacy`: pnpm v10 otherwise refuses to deploy unless the workspace opts in
# to injected dependencies globally; the flag keeps that choice scoped to here.
RUN pnpm --filter @saas/api deploy --prod --legacy /app/out

# The Prisma client we generated above lives in the workspace node_modules, not
# in /app/out. Re-generate it INSIDE /app/out so the shipped node_modules has
# the engine + client. (prisma is a runtime dependency — see package.json — so
# its CLI is present here.)
RUN cd /app/out && ./node_modules/.bin/prisma generate

# ---- runner: the tiny final image -----------------------------------------
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
# Everything we need, and nothing else, from the deploy output.
COPY --from=build /app/out/node_modules ./node_modules
COPY --from=build /app/out/dist ./dist
COPY --from=build /app/out/package.json ./package.json
# Schema + migrations: the entrypoint runs `prisma migrate deploy` on startup.
COPY --from=build /app/out/prisma ./prisma
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Run as the non-root `node` user that the base image already provides.
USER node
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
