# Contributing to ABAK ERP

## Prerequisites

- Node.js **20+** (`node -v`)
- pnpm **8+** (`pnpm -v`) — install via `corepack enable && corepack prepare pnpm@8.15.0 --activate`
- PostgreSQL 15+ (needed from issue #004 onwards)

## Local setup

```bash
git clone https://github.com/LUBB-INTEGREATED/ABAK_ERP.git
cd ABAK_ERP
pnpm install
pnpm build
```

## Nx command cheat-sheet

| Command                           | What it does                                                        |
| --------------------------------- | ------------------------------------------------------------------- |
| `pnpm build`                      | `nx run-many -t build` — build every project in dep order           |
| `pnpm lint`                       | `nx run-many -t lint` — lint + module-boundary check                |
| `pnpm test`                       | `nx run-many -t test`                                               |
| `pnpm typecheck`                  | `nx run-many -t typecheck`                                          |
| `pnpm affected:build/lint/test`   | Only run targets for projects affected vs. `main`                   |
| `pnpm graph`                      | Interactive dependency graph in the browser                         |
| `pnpm nx build <project>`         | Build a single project                                              |
| `pnpm nx show projects`           | List every project in the workspace                                 |
| `pnpm nx show project <project>`  | Inspect targets, tags, and deps of a single project                 |
| `pnpm nx reset`                   | Clear Nx's cache (fix stale-cache weirdness)                        |

## Tagging convention

Every project **must** be tagged with a `scope:*` and a `type:*`. The module-boundary ESLint rule (`@nx/enforce-module-boundaries`, configured in `eslint.config.mjs`) uses tags to decide what imports are legal.

### Scopes

- `scope:shared` — cross-cutting, used by everyone
- `scope:lead-capture`, `scope:crm`, `scope:sales-pipeline`, `scope:quotation`, `scope:marketing` — Phase 1 modules
- `scope:accounting`, `scope:hr` — reserved for future modules
- `scope:web`, `scope:api` — the deployable apps; may depend on anything

Rule: a module may only import from itself and `scope:shared`. That stops, say, `accounting` from reaching into `hr` internals.

### Types (inside a scope)

- `type:feature` — orchestrates UI + data-access for a user-facing flow
- `type:ui` — presentational only, no data access
- `type:data-access` — API clients, server actions, data hooks
- `type:util` — pure functions, no UI, no network
- `type:types` — TypeScript types only, no runtime code (graph leaf)

## Generating libraries

**Never** `mkdir` a new project — use the generator so tags, tsconfig references, and lint configs stay consistent.

```bash
# Shared library
pnpm nx g @nx/js:lib packages/shared/<name> \
  --name=shared-<name> \
  --bundler=tsc --linter=eslint --unitTestRunner=vitest \
  --tags=scope:shared,type:<util|ui|types|data-access>

# Module-scoped library
pnpm nx g @nx/js:lib packages/<module>/<name> \
  --name=<module>-<name> \
  --bundler=tsc --linter=eslint --unitTestRunner=vitest \
  --tags=scope:<module>,type:<feature|ui|data-access|util|types>

# React library (when UI work begins)
pnpm nx g @nx/react:lib packages/<module>/ui \
  --name=<module>-ui --tags=scope:<module>,type:ui

# NestJS module / service
pnpm nx g @nx/nest:lib packages/<module>/api \
  --name=<module>-api --tags=scope:<module>,type:data-access
```

Apps (Next.js & Nest.js) are scaffolded in issues #002 and #003:

```bash
pnpm nx g @nx/next:app packages/web --tags=scope:web
pnpm nx g @nx/nest:app packages/api --tags=scope:api
```

## Commit conventions

Conventional Commits:

- `feat(<scope>):` — new feature
- `fix(<scope>):` — bug fix
- `refactor(<scope>):` — internal refactor, no behaviour change
- `docs:` — documentation only
- `test:` — tests only
- `chore:` — tooling, build, config

Scopes match our Nx scopes: `lead-capture`, `crm`, `sales-pipeline`, `quotation`, `marketing`, `accounting`, `hr`, `shared`, `web`, `api`, `infra`.

## Branching

- `main` — protected, always deployable
- Feature branches: `feature/M<module>-<issue>-<short-description>` (e.g. `feature/M1-014-lead-form`)
- Fix branches: `fix/<issue>-<short-description>`

## Pull requests

1. Push your branch.
2. Run `pnpm affected:lint && pnpm affected:test && pnpm affected:build` locally.
3. Open a PR against `main`; link the GitHub issue being resolved.
4. Request review from at least one teammate.

## Code style

- TypeScript strict mode is non-negotiable (configured in `tsconfig.base.json`).
- Prettier config lives at the repo root (`.prettierrc`). Run `pnpm format` before committing.
- ESLint flat config is in `eslint.config.mjs`; per-project lint configs extend it.

## Remote caching (optional)

Nx supports remote caching via Nx Cloud (free tier available). If you want shared build caches across developers and CI:

```bash
pnpm nx connect
```

This adds an `nxCloudId` to `nx.json`. Until then we run local-only caching (`.nx/cache`).
