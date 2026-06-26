# SaaS Dashboard — Production-Shaped Monorepo

A multi-tenant SaaS dashboard built to **read like real production code**, so you
can learn the patterns by dissecting them. Not a toy CRUD app: it has the layers,
boundaries, and cross-cutting concerns a real team would ship.

## Stack

| Layer      | Choice                          | Why it's here                                         |
| ---------- | ------------------------------- | ----------------------------------------------------- |
| Frontend   | **Next.js 15** (App Router)     | React framework with routing, SSR, and server actions |
| Backend    | **NestJS 11** (Node.js)         | Opinionated, modular, DI-based — scales past CRUD     |
| Database   | **PostgreSQL 17**               | Relational, transactional, the SaaS default           |
| ORM        | **Prisma 6**                    | Type-safe DB access + migrations                      |
| Monorepo   | **pnpm workspaces + Turborepo** | Share code between apps, run tasks with caching       |
| Validation | **Zod** (shared package)        | One schema, validated on both client and server       |
| API docs   | **Swagger / OpenAPI**           | Interactive docs at `/docs`, fed from the Zod schemas |
| AI         | **Google Gemini** (free tier)   | AI assistant, via the OpenAI-compatible endpoint      |

## What's built

- **Auth** — register/login with bcrypt-hashed passwords and JWT **access + refresh** tokens (short-lived access, rotating refresh, revocable on logout). Global auth-by-default guard; opt out with `@Public()`.
- **Multi-tenant RBAC** — organizations with per-membership roles (OWNER/ADMIN/MEMBER), enforced by a guard that returns 404 to non-members (so org existence doesn't leak) and 403 for insufficient role.
- **AI assistant** — a "summarize my workspace" feature: the API calls Gemini server-side (key never reaches the browser) over the caller's real, role-scoped data. Provider-swappable via one base URL.
- **Interactive API docs** — Swagger UI at `/docs`, with request/response shapes generated from the shared Zod contracts (no hand-maintained duplicates).
- **Server-rendered web app** — Next.js App Router with Server Components, Server Actions for auth, and an httpOnly-cookie session so the token never lives in client JavaScript.

## Repository layout

```
.
├── apps/
│   ├── api/      → NestJS backend (REST API, auth, business logic, Prisma)
│   └── web/      → Next.js frontend (App Router UI + server-side API calls)
├── packages/
│   └── contracts/ → Zod schemas + TS types SHARED by api and web
├── pnpm-workspace.yaml  → declares the workspace folders
├── turbo.json           → task graph (build/dev/lint/typecheck) with caching
├── tsconfig.base.json   → TS settings every package extends
└── docker-compose.yml   → optional local Postgres
```

### Why a monorepo?

The frontend and backend must agree on the *shape* of data (a `RegisterInput`,
a `User`, an `Organization`). In separate repos that contract drifts. Here we
put it in `packages/contracts` **once** and import it from both sides — change it
and TypeScript flags every caller on both client and server.

## The architecture (backend)

NestJS is organized into **modules** (one folder per domain concept). Each request
flows through clear layers, and each layer only knows about the one below it:

```
HTTP request
   │
   ▼
Controller   → HTTP concern only: routes, status codes, reads DTOs. Thin.
   │
   ▼
Service      → business logic. Knows nothing about HTTP. Reusable & testable.
   │
   ▼
PrismaService → data access (the "repository") — the only thing that touches SQL.
   │
   ▼
PostgreSQL
```

Cross-cutting concerns live in `src/common/` (exception filter, logging
interceptor, decorators) and `src/config/` (typed, validated env vars).

### The domain: multi-tenancy

A real SaaS isn't "users own rows." It's **organizations** (tenants) that contain
users, where one user can belong to many orgs with different roles. We model that
with a join-table-with-data:

```
User  ──< Membership >──  Organization
              │
          role: OWNER | ADMIN | MEMBER
```

Authorization isn't "is this user logged in" — it's "does this user have a
membership in *this* org with a sufficient role." See
`apps/api/src/organizations/guards/org-role.guard.ts`.

## Getting started

```bash
# 1. Install all workspace dependencies (one lockfile for the whole repo)
pnpm install

# 2. Point the API at a database. Either use your local Postgres:
cp apps/api/.env.example apps/api/.env       # then edit DATABASE_URL
#    ...or `docker compose up -d` if you install Docker.
#    (Optional) for the AI assistant, add a FREE Gemini key to apps/api/.env:
#    GEMINI_API_KEY="..."   →  get one at https://aistudio.google.com/apikey
#    The app boots fine without it; only the /assistant routes need it.

# 3. Create the schema + generate the typed Prisma client + seed demo data
pnpm db:migrate
pnpm db:seed

# 4. Run everything (Turbo runs api + web in parallel)
pnpm dev
#    API  → http://localhost:4000/api
#    Docs → http://localhost:4000/docs   (interactive Swagger UI)
#    Web  → http://localhost:3000
```

Demo login (from the seed): `alice@example.com` / `password123`.

## Useful scripts (run from repo root)

| Command            | What it does                                              |
| ------------------ | -------------------------------------------------------- |
| `pnpm dev`         | Run api + web in dev mode (hot reload)                   |
| `pnpm build`       | Build every app/package in dependency order (cached)     |
| `pnpm typecheck`   | Type-check the whole repo                                |
| `pnpm db:migrate`  | Apply Prisma migrations to the dev DB                    |
| `pnpm db:seed`     | Insert demo orgs/users so the UI has data                |
| `pnpm db:studio`   | Open Prisma Studio (visual DB browser)                   |

## Where to read first (a learning path)

1. `packages/contracts/src/` — the shared data shapes. Start here; everything refers back.
2. `apps/api/prisma/schema.prisma` — the database model.
3. `apps/api/src/main.ts` → `app.module.ts` — how the server boots and wires modules.
4. `apps/api/src/auth/` — register/login, password hashing, JWT access+refresh.
5. `apps/api/src/organizations/` — the multi-tenant authorization story.
6. `apps/api/src/assistant/` — the AI assistant (one server-side Gemini call over real data).
7. `apps/api/src/common/swagger/zod-openapi.ts` — the Zod → OpenAPI bridge that powers `/docs`.
8. `apps/web/src/lib/` — the httpOnly session, server-side API client, and auth Server Actions.
9. `apps/web/src/app/` — App Router route groups, Server vs Client Components, the dashboard.
