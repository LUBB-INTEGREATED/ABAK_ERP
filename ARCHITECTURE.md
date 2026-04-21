# ABAK ERP Architecture

High-level view of how the code in this repository is organized, how
requests flow through the system, and where the seams live.

## System diagram

```
┌──────────────────────────┐         ┌──────────────────────────┐
│       packages/web       │         │       packages/api       │
│      (Next.js 16 PWA)    │         │    (Nest.js + Prisma)    │
│                          │         │                          │
│   Server & Client React  │         │   REST API  /api/v1/**   │
│   Zustand auth store     │────────▶│   JwtAuthGuard (global)  │
│   axios interceptors     │         │   Feature modules (m1..) │
│   shadcn/ui primitives   │         │                          │
└─────────┬────────────────┘         └────────┬─────────────────┘
          │                                   │
          │ HTTP (JSON)                       │ Prisma Client
          │                                   ▼
          │                          ┌──────────────────────────┐
          │                          │      PostgreSQL 16       │
          │                          │  (users, leads, refresh  │
          │                          │   tokens, …)             │
          │                          └──────────────────────────┘
          │
          ▼ Service worker
   offline page, runtime cache
```

Shared code lives in `packages/shared/{types,utils,ui}`. Module-scoped
libraries land under `packages/<module>/*` (added per sprint).

## Repository layout

```
ABAK_ERP/
├── .github/workflows/       # CI (lint, typecheck, build, prisma)
├── .husky/                  # pre-commit + commit-msg hooks
├── packages/
│   ├── api/                 # Nest.js app (scope:api)
│   ├── api-e2e/
│   ├── web/                 # Next.js app (scope:web)
│   │   └── src/components/ui/  # shadcn primitives
│   └── shared/
│       ├── types/           # type:types — leaf of graph
│       ├── utils/           # type:util
│       └── ui/              # type:ui
├── prisma/                  # schema + migrations + seed
├── nx.json                  # targets, plugins, caching
├── eslint.config.mjs        # module-boundary enforcement
├── commitlint.config.cjs    # conventional commits
└── docker-compose.yml       # local Postgres
```

Module boundaries are enforced with `@nx/enforce-module-boundaries`
(see `eslint.config.mjs`). Tags: `scope:*` + `type:*`.

## Authentication flow

1. Client posts credentials to `POST /api/v1/auth/login`.
2. `AuthService` looks up the user, compares password with bcrypt,
   updates `lastLoginAt`, and issues:
   - **access token** — 15-minute JWT (in response body)
   - **refresh token** — 7-day JWT stored in `refresh_tokens` table
3. Zustand persists the refresh token + user profile in `localStorage`
   under key `auth-storage`. The access token stays in memory.
4. `apiClient` (axios) attaches `Authorization: Bearer <access>` to
   every request via a request interceptor.
5. On a 401 response, the client calls `POST /auth/refresh` once. The
   server rotates both tokens (old refresh deleted, new pair issued)
   and the original request is retried.
6. `POST /auth/logout` deletes the refresh token row, making further
   refresh attempts fail.

A global `JwtAuthGuard` (`packages/api/src/app/app.module.ts`) protects
every route by default; mark exceptions with the `@Public()` decorator.
Role-based checks use `@Roles(UserRole.X)` + `RolesGuard`.

## Request lifecycle (typical protected endpoint)

```
Browser ──▶ Next.js route handler / RSC ──▶ axios (packages/web/src/lib/api-client.ts)
                                                │
                                                ▼
                                         Nest.js HTTP pipeline
                                                │
                                                ▼
                  JwtAuthGuard (skip if @Public) → JWT verify → user lookup
                                                │
                                                ▼
                             RolesGuard → controller → service → PrismaClient
                                                │
                                                ▼
                                         PostgreSQL
```

## Data model

Canonical schema lives at `prisma/schema.prisma`. Key tables so far:

- `users` — with bcrypt password, role, status, audit fields
- `refresh_tokens` — FK to users, used for rotation on refresh
- `leads` — initial entity used by seed data

Migrations are committed under `prisma/migrations/`. Run
`pnpm prisma:migrate` locally; CI runs `prisma validate` on every PR.

## Frontend architecture

- **App Router**: Route groups `(auth)` and `(dashboard)` separate
  anonymous vs. authenticated shells.
- **State**: Zustand store at `packages/web/src/lib/auth.ts`; server
  data will land in TanStack Query (already installed) per module.
- **UI**: shadcn primitives under `src/components/ui/*`. Brand tokens
  live in `src/app/globals.css` + `tailwind.config.ts`.
- **PWA**: `public/manifest.webmanifest` + `public/sw.js`; service
  worker registered in `src/components/pwa-register.tsx` (prod only).

## Backend architecture

- **Entry**: `packages/api/src/main.ts` sets the `api/v1` prefix,
  enables validation, and mounts Swagger at `/api/docs`.
- **Modules**: Each feature gets its own `packages/api/src/modules/<m>`
  directory with controller + service + dto (+ guards/strategies).
- **Global auth**: JwtAuthGuard registered via `APP_GUARD` in
  `AppModule`; ConfigModule exposes env-driven config (`auth`,
  `database`).
- **Validation**: class-validator + `ValidationPipe` strip unknown
  fields and enforce DTO constraints.

## CI pipeline

`.github/workflows/ci.yml` runs on PRs and pushes to `main`:

1. **lint** — `pnpm format:check` + `pnpm nx affected -t lint`
2. **typecheck** — `pnpm nx affected -t typecheck` (after `prisma generate`)
3. **build** — `pnpm nx affected -t build` (needs lint + typecheck)
4. **prisma-validate** — `prisma validate` + `prisma format --check`

All jobs use `nrwl/nx-set-shas@v4` so affected detection works against
the correct merge base.
