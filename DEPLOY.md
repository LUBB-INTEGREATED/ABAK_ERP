# Deployment notes

Operational prerequisites for running ABAK ERP in a server / container. Keep
this in sync with `.github/workflows/deploy.yml`, `scratch/ecosystem.config.js`
(pm2), and the audit (`docs/specs/PROD_READINESS_AUDIT_2026_06_05.md`).

## 1. Headless Chromium for PDF rendering (A-8) — REQUIRED

The quote / price-offer PDF feature renders HTML to A4 via headless Chromium
(`packages/api/src/modules/pdf/pdf-render.service.ts`, using `playwright`).
**`pnpm install` does NOT download the Chromium binary** (there is no
`postinstall` hook and pnpm does not run Playwright's browser download by
default), so without an explicit provisioning step the first PDF request fails
at runtime with:

```
browserType.launch: Executable doesn't exist at .../chromium-XXXX/chrome-linux/chrome
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║     npx playwright install                                 ║
╚════════════════════════════════════════════════════════════╝
```

On the deploy target (ARM Ubuntu), AFTER `pnpm install` and BEFORE starting the
API, run:

```bash
# Chromium + its ~50 system shared libraries
npx playwright install --with-deps chromium

# Arabic (and CJK) fonts so the RTL price-offer document renders glyphs, not boxes
sudo apt-get update && sudo apt-get install -y fonts-noto fonts-noto-cjk
```

Notes:

- The browser binary lives under `node_modules/.cache/ms-playwright` (or
  `PLAYWRIGHT_BROWSERS_PATH` if set). If you prune/copy `node_modules` between
  build and run (e.g. nx prune), make sure that cache survives — otherwise the
  binary is gone at runtime. Pin `PLAYWRIGHT_BROWSERS_PATH` to a stable path the
  runtime user can read.
- Chromium launches with `--no-sandbox` (see `pdf-render.service.ts`). In a
  container run as a non-root user or with the appropriate seccomp profile.
- Memory: a Chromium launch needs headroom. The pm2 config
  (`scratch/ecosystem.config.js`) caps the API at ~700M; on a small box (6 GB)
  budget for the Chromium process on top of Node.

### Docker

In a Dockerfile, the equivalent layer (after the dependency install):

```dockerfile
RUN npx playwright install --with-deps chromium \
 && apt-get update && apt-get install -y --no-install-recommends fonts-noto fonts-noto-cjk \
 && rm -rf /var/lib/apt/lists/*
```

### Smoke test after deploy

Issue/fetch one quote PDF to confirm Chromium is wired up:

```bash
curl -fsS -H "Authorization: Bearer $TOKEN" \
  "https://<host>/api/v1/quotes/<id>/pdf" -o /tmp/smoke.pdf && file /tmp/smoke.pdf
```

## 2. Required environment (A-3 / A-6)

The API **refuses to boot in production** without a strong `JWT_SECRET`
(validated at startup by `packages/api/src/config/env.validation.ts`). See
`.env.example`. At minimum set, on the target:

```bash
NODE_ENV=production
JWT_SECRET="$(openssl rand -base64 48)"   # >= 32 chars, NOT the dev fallback
DATABASE_URL="postgresql://..."
```

## 3. Database seeding (A-4 / A-22) — do NOT wipe prod

`prisma db seed` runs the **non-destructive** RBAC seed (upserts permissions /
roles / departments only). The destructive demo seed that wipes every table is
reachable only via `npm run prisma:seed:demo` (which sets
`ALLOW_DESTRUCTIVE_SEED=1`) and refuses to run when `NODE_ENV=production`.

**Never run `prisma migrate reset` against the production database** — it drops
and recreates the schema.
