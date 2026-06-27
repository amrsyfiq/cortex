# syntax=docker/dockerfile:1
# ===========================================================================
# Web image (Next.js 15, App Router). Build context is the REPO ROOT.
#
# Thanks to `output: 'standalone'` (next.config.ts), `next build` emits a
# minimal self-contained server under .next/standalone. The final image ships
# only that — no pnpm, no source, no dev deps.
# ===========================================================================

# ---- base -----------------------------------------------------------------
FROM node:22-slim AS base
RUN corepack enable
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

# ---- build ----------------------------------------------------------------
FROM base AS build
# Manifests first for cached installs (see api/Dockerfile for the why).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web

# Build the shared package first, then the Next app.
# NOTE: no NEXT_PUBLIC_* build args here — this app reads its config (API_URL)
# at RUNTIME on the server, so nothing secret is baked into the image.
RUN pnpm --filter @saas/contracts build && \
    pnpm --filter @saas/web build

# ---- runner ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
# Bind to all interfaces inside the container so the reverse proxy can reach it.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

# The standalone bundle. In a monorepo the traced output preserves the
# apps/web/ path, so server.js ends up at apps/web/server.js.
COPY --from=build /app/apps/web/.next/standalone ./
# Static assets and (if present) the public folder aren't part of the traced
# server bundle, so copy them alongside it.
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
