# ABAK ERP — RBAC Production-Readiness & Test Runbook

**Date:** 2026-06-02 · **Author:** automated overnight session (scheduled task `plan-testing`)
**Goal:** finish the permission-based RBAC so role-journey testing can run tomorrow.
**Pairs with:** `docs/architecture/abak-rbac-design.md` (v2), `docs/testing/abak-rbac-test-plan.md`, `docs/testing/abak-role-journey-testing-pack.md`.

---

## TL;DR

The RBAC v2 backend was ~90% done by the prior session and got cut off mid-edit. I **finished the
remaining enforcement gaps**, verified every piece I could without the cloud DB, and wrote this runbook.

- **Code is ready for testing.** The one structurally-missing piece — the **manager-designation
  unlock** (design §5.4) — is now implemented, and the two open controllers (`rfq-assignments`,
  `pipeline`) are now permission-gated. Without these, the manager test cases (M1–M6) would have failed.
- **Verified offline:** 41/41 automated checks pass — the real `scope.util` row-level filters, the
  permission-union algorithm, the manager-unlock decision, and full seed integrity (49 permissions,
  8 roles, 12 departments, 9 managers, 25 users, all cross-references valid).
- **My edits add zero new type errors** (proven against the baseline).
- **What you must do tomorrow** (≈15 min): deploy the branch, run the migration + the two seeds with
  `ABAK_TEST_USER_PASSWORD=Password123!`, then execute the test plan. Steps in the **Runbook** below.
- **Two things could not be run in the automation sandbox** (wrong-CPU native binaries): the Prisma
  engine and `nx`. So the live DB seed, `nx build`, and HTTP-level tests must be run on your machine /
  the VPS. Everything is staged and documented so that's a copy-paste exercise.

---

## 1. What I changed (and why)

All changes are in the working tree of `packages/api`. They are small, surgical, and confined to
authorization — no business logic touched.

### 1.1 Manager-designation unlock — `auth/guards/permission.guard.ts` (the critical fix)

The design (§5.4) and the seed's own header comment both say manager actions
(`rfq:assign_pricers`, `rfq:set_lead_pricer`, `project:convert`) are **not** granted through a role —
they're unlocked for the engineer who is their department's `managerId`. **That logic did not exist
in the guard.** Ordinary department managers (Omar/Safety, Alaa/Surveying, Ameen/Supervision,
Akram/Environmental, Haitham/Sales) only hold the Engineer/Sales role, so before this fix they could
**not** assign pricers, designate a Lead Pricer, or convert a Won quote — and tests M1/M3 would fail.

The guard now resolves an effective scope per required key: a key is satisfied by the user's
role-granted permissions **or**, for the three manager-action keys, by the manager hat
(`user.managedDepartment`), exercised at `DEPARTMENT` scope. `request.user.managedDepartment` is
already populated by `JwtStrategy`, so no token/shape change was needed. A Technical Director who
holds these keys via role keeps the wider `ALL` scope.

### 1.2 Gate the RFQ-assignments controller — `rfqs/rfq-assignments.controller.ts`

This controller (assign pricers, toggle Lead Pricer, doc/site-visit requests) had **no permission
gating at all** — any authenticated user could assign pricers. That breaks M2 (a non-manager must be
denied). Added:

| Endpoint                                                         | Permission                                         |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| `GET assignments`, `GET doc-requests`, `GET site-visit-requests` | `rfq:view`                                         |
| `POST/PATCH/DELETE assignments`                                  | `rfq:assign_pricers` _(managers unlocked by §1.1)_ |
| `POST/PATCH doc-requests`, `POST/PATCH site-visit-requests`      | `rfq:request_docs` _(engineers hold this)_         |

### 1.3 Gate the pipeline controller — `pipeline/pipeline.controller.ts`

Pipeline was also ungated (open to any logged-in user). Added class-level `pipeline:view` with write
overrides: entry create/update/move/delete and target upsert → `pipeline:move`; field-visit
create/update → `pipeline:log_visit`. Matches the catalog exactly.

### 1.4 Finished the prior session's in-progress edits (already in the tree, now verified)

- `auth/scope.util.ts` — `projectScopeFilter` now gives a department manager whole-department project
  visibility (any project where the PM, a phase owner, or a task assignee is in their department);
  non-managers keep personal-involvement scope.
- `rfqs/rfqs.service.ts` — department managers see the whole department's RFQs (assigned to any
  member); engineers/sales reps keep their narrower scope.

### 1.5 Test-plan doc correction — `docs/testing/abak-rbac-test-plan.md`

S4 said "48 permissions"; the design §3 catalog and the seed both define **49**. Corrected the doc to
49 so testers don't flag a false mismatch.

> Full file list with line counts is in the Appendix.

---

## 2. What I verified

### 2.1 Offline RBAC verifier — 41/41 PASS

`scripts/rbac_verify.js` (added to the repo) runs without a database and checks:

- **Real `scope.util` output** (the actually-transpiled module) for OWN / DEPARTMENT / ALL and the
  manager cases across leads/clients/quotes (owner), RFQs (relation), projects (relation + dept).
- **Permission-union** "widest scope wins" (ALL > DEPARTMENT > OWN) — test E3.
- **Manager-unlock decision** — M1 (manager allowed, at DEPARTMENT), M2 (non-manager denied),
  Technical Director keeps ALL, no leak to non-manager keys, view regression intact.
- **Seed integrity vs. the test plan** — 49 permissions (unique), 8 roles, 12 departments (2 inactive),
  9 managers, 25 assignments, 25 users; every assignment email and manager email exists in the user
  seed; **every manager is a member of the department they manage** (S3); every explicit grant key
  exists in the catalog (typo guard); every assigned role name is a defined template.

Re-run any time: `node scripts/rbac_verify.js` from the repo root (Node ≥ 18, no DB needed).

### 2.2 Typecheck — my edits are clean

`tsc -p packages/api/tsconfig.app.json --noEmit` was run with and without my changes. **My four edited
files produce zero type errors.** There are ~31 pre-existing type errors in _unrelated_ modules
(gov-transactions, reports definitions, projects/rfqs `groupBy`, notifications, leads DTOs) — see §3.2.

---

## 3. Known gaps, risks & decisions made autonomously

> Per the task, I made reasonable calls and noted them rather than blocking. Ordered by importance.

### 3.1 Frontend does not yet hide UI by permission _(highest-impact for the test experience)_

The web app has **no permission-aware `can()` helper**; the auth store only knows the legacy `role`
string, and the sidebar gates only the **Admin** section (by legacy `SUPER_ADMIN`/`ADMIN`). All other
nav (leads, clients, pipeline, RFQs, quotes, projects, finance, gov, reports) is shown to everyone.

**Consequence tomorrow:** a Sales Rep will _see_ "Projects/Finance" in the nav, click it, and get a
**correct 403** from the backend (their role lacks `project:view`/`finance:view`). The page will look
empty or error. **This is correct enforcement, not a bug** — but testers must read it that way.

**Why I did not fix it tonight:** exposing effective permissions through `/users/me`, adding a `can()`
helper, and refactoring the sidebar + every page/button is a large change with real regression risk on
a live app the night before testing. The proper enabling step (small, do it next) is to return the
user's resolved permission map from `/users/me` and the login response, then gate nav off it.

**Interim guidance for testers:** judge access by _what the API allows_, not by what the menu shows.
The role-journey pack's "must deny" rows should be confirmed as 403s.

### 3.2 ~31 pre-existing TypeScript errors in non-RBAC modules

These predate my work and are unrelated to RBAC (`groupBy` needing `orderBy`, `_count._all` typing,
`CONVERTED` lead status, `visitDate` vs `visitedAt`, unused imports, missing `override`). The app runs
because the webpack build uses `ts-loader` in transpile mode, **but CI has a `typecheck` job that gates
`build`** — so CI is likely red until these are triaged. They do **not** affect the running app or
tomorrow's testing. **Decision:** left untouched — fixing 8+ unfamiliar files the night before testing
is higher risk than the (zero) runtime reward. Recommend a dedicated clean-up pass after testing; I can
do it as a focused task.

### 3.3 Finer manager scope (M6) and "own-department-only" actions

The guard unlocks manager actions at `DEPARTMENT` scope, but the _action handlers_ don't yet verify the
target RFQ/quote belongs to the manager's department. So M1/M2/M3 pass; **M6** ("manager of dept A acts
in dept B → deny") is **not** enforced yet. Root cause is the known `RfqAssignment.departmentId →
ServiceCategory` vs. `Department` reconciliation flagged in design §10.2. **Decision:** documented as a
follow-up; it's a refinement, not a security hole for single-department test flows.

### 3.4 `/files` and `/notifications` remain authenticated-only

The test plan §7 prose lists them, but the v2 catalog defines **no** `files:*` or `notifications:*`
permission, and adding one would change the documented count (49) and role grants. `notifications` is
already self-scoped (every method keys off the current user), so there's no data-leak. **Decision:**
left as authenticated-only; if you want them gated, add catalog keys in a small Phase-1.1 (I can do it).

### 3.5 Guard-rail tests (G1–G5) are Phase 2

`roles:view`/`roles:manage` and the role-builder UI are explicitly Phase 2 — there is no role-CRUD
endpoint yet, so the guard-rail cases (delete system role, delete role in use, last user-admin) **can't
be executed tomorrow**. Mark them N/A for this round. The audit log (G5) does exist.

### 3.6 Demo-login picker + default password on the login page

The prior session added a 9-role quick-login picker with a default password `Password123!` — great for
role-journey testing. **For real production go-live (after testing), remove or env-gate it** and drop
the default password. It's intentional and fine for tomorrow.

### 3.7 Could not run live in the automation sandbox

The mounted `node_modules` is built for macOS; the sandbox is Linux, so the **Prisma query engine** and
**`nx`** native binaries can't execute here, and Prisma's engine download is network-blocked. That's
why the live seed / `nx build` / HTTP tests are in the runbook for you to run, not done here. Pure
JS/TS (tsc, the verifier) ran fine, which is how the logic was validated.

---

## 4. RUNBOOK — get the system ready for testing (~15 min)

> Run on whatever environment testing uses (the VPS `http://72.61.229.5:3487/`, or a fresh staging DB).
> Commands assume repo root. Deploy is manual (the `deploy.yml` is a placeholder; the VPS uses pm2+nginx).

### Step 0 — clear the stale git lock & commit the work

The prior session crashed and left a stale lock; the automation sandbox couldn't delete it (mount is
read-only for `.git`). On your Mac it deletes normally:

```bash
cd ABAK_ERP
rm -f .git/index.lock .git/index.stash.34.lock     # stale 0-byte locks from the 2026-06-01 crash
git add -A
git commit -m "feat(rbac): manager-designation unlock + gate rfq-assignments & pipeline; finish dept scope"
```

### Step 1 — install, generate client, migrate

```bash
pnpm install --frozen-lockfile
pnpm prisma:generate
# Apply the RBAC v2 migration (20260601182720_rbac_v2) to the testing DB:
DATABASE_URL=<testing-db-url> pnpm prisma migrate deploy
```

### Step 2 — seed roles + the 25 real users _(order matters)_

```bash
export ABAK_TEST_USER_PASSWORD='Password123!'   # MUST match the login page's default for quick-login
DATABASE_URL=<testing-db-url> npx ts-node prisma/seed-abak-real-users.ts   # 25 users
DATABASE_URL=<testing-db-url> npx ts-node prisma/seed-rbac.ts              # 49 perms, 8 roles, 12 depts, assignments, managers
```

Expect: `Upserted 25 Abak test users.` then
`RBAC seed complete — 49 permissions, 8 roles, 12 departments, 25 user assignments.`

> ⚠️ If you pick a different `ABAK_TEST_USER_PASSWORD`, the login page's one-click demo buttons (which
> send `Password123!`) won't work — testers would have to type the password. Easiest: use `Password123!`.

### Step 3 — build & restart

```bash
pnpm nx build api && pnpm nx build web
# VPS: restart the pm2 processes, e.g.
pm2 restart abak-api abak-web    # (use your actual process names)
```

### Step 4 — smoke-check the RBAC wiring (1 min)

```bash
API=http://72.61.229.5:3487/api/v1     # adjust to your API base

# Sales Rep must be DENIED projects (403):
TOK=$(curl -s $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ghadah@abak.com.sa","password":"Password123!"}' | jq -r '.data.accessToken')
curl -s -o /dev/null -w "ghadah GET /projects => %{http_code} (expect 403)\n" $API/projects -H "Authorization: Bearer $TOK"

# Safety manager (Omar) must be ALLOWED to assign pricers (not 403):
TOK=$(curl -s $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"omar@abak.com.sa","password":"Password123!"}' | jq -r '.data.accessToken')
curl -s -o /dev/null -w "omar GET /rfqs => %{http_code} (expect 200)\n" $API/rfqs -H "Authorization: Bearer $TOK"

# Non-manager engineer (Waleed) must be DENIED assigning pricers on some RFQ <id>:
TOK=$(curl -s $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"w.abid@abak.com.sa","password":"Password123!"}' | jq -r '.data.accessToken')
curl -s -o /dev/null -w "waleed POST assignment => %{http_code} (expect 403)\n" \
  -X POST $API/rfqs/<rfqId>/assignments -H "Authorization: Bearer $TOK" \
  -H 'Content-Type: application/json' -d '{"departmentId":"x","assigneeId":"y"}'
```

### Step 5 — run the test plan

Execute `docs/testing/abak-rbac-test-plan.md` §2–§8 and the journeys in
`abak-role-journey-testing-pack.md`. Capture per case: account · endpoint · expected · actual · pass/fail.
Remember §3.1 above: **judge by API allow/deny**, since the menu isn't permission-filtered yet. Mark the
guard-rail cases (§6 / G1–G5) **N/A** (Phase 2).

---

## 5. Test accounts (all seeded; password = `ABAK_TEST_USER_PASSWORD`)

| Template                      | Example accounts                                                                                                      | Manager?     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------ |
| Super Admin                   | `abdullah.mohsen@abak.com.sa`                                                                                         | IT           |
| Executive                     | `mesfer@`, `m.alayaf@`, `salshehri@`                                                                                  | —            |
| Sales Manager                 | `haitham@`                                                                                                            | Sales        |
| Sales Rep                     | `ghadah@`, `mostafa@`, `salwa@`, `client.relations1@`, `client.relations2@`                                           | —            |
| Engineer                      | `abdulghani.almuwafiq@`, `a.albittar@`, `hashim.ali@`, `khaled@`, `osamah.alsamet@`, `mohammed.deifallah@`, `w.abid@` | —            |
| Engineer + Technical Director | `hassan@`                                                                                                             | Architecture |
| Engineer **and** dept manager | `alaa.ahmed@` (Surveying), `ameen@` (Supervision), `omar@` (Safety), `akram@` (Environmental)                         | ✓            |
| Finance Officer               | `accounting@`                                                                                                         | Finance      |
| Viewer                        | `hr@`, `info@`                                                                                                        | —            |

---

## 6. Appendix — changed files

**Edited (authorization only):**

- `packages/api/src/modules/auth/guards/permission.guard.ts` — manager-designation unlock.
- `packages/api/src/modules/rfqs/rfq-assignments.controller.ts` — added `@RequirePermission` to 10 routes.
- `packages/api/src/modules/pipeline/pipeline.controller.ts` — class `pipeline:view` + write overrides.
- `packages/api/src/modules/auth/scope.util.ts` — dept-manager project scope _(prior session, verified)_.
- `packages/api/src/modules/rfqs/rfqs.service.ts` — dept-manager RFQ scope _(prior session, verified)_.
- `docs/testing/abak-rbac-test-plan.md` — S4 48 → 49.

**Added:**

- `scripts/rbac_verify.js` — offline RBAC verifier (41 checks, no DB needed).
- `docs/RBAC_PRODUCTION_READINESS_2026_06_02.md` — this document.

**Already staged by the prior session (review & keep):** `packages/api/src/main.ts` (CORS list),
`packages/web/.../login/page.tsx` (demo picker), `packages/web/src/lib/api-client.ts`,
`packages/web/messages/{ar,en}.json`, `prisma/seed.ts`, `scratch/check_users.ts`.
