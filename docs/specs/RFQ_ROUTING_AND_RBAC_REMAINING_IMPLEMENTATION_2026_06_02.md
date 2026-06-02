# ABAK ERP — Remaining Implementation Spec: RFQ Routing, Session/Display Bug, RBAC Scope Hardening

**Date:** 2026-06-02
**Author:** audit session (Claude Code, branch `main`, base commit `262c929`)
**Audience:** the engineer/agent who will implement the fixes.
**Source bugs (reported by the product owner):**

1. Sales rep creates a lead → converts to client → **client disappears** from the list.
2. Inside Ghadah (Sales Rep) account, requested an RFQ → **shows in Pipeline but not on the RFQ page**.
3. After login, leads/clients are visible → **switch module and come back → they disappear + an API error**.
4. Product owner clarified the **intended RFQ routing & assignment model** (multi-select services → department-manager routing → pricer assignment → Lead Pricer compile). This is only partially built.

This document is the gap analysis + implementation spec for all four. Each cluster has: **Current state**, **Gap**, **Spec**, **Acceptance criteria**. Implement in the order given in §6.

> Pairs with: `docs/RBAC_PRODUCTION_READINESS_2026_06_02.md`, `docs/testing/abak-rbac-test-plan.md`, `docs/testing/abak-journey-test-checklist.md`. Supersedes the "planned enhancement" notes in `leads.service.ts requestRfq()`.

---

## 0. TL;DR — what is actually broken

| #   | Symptom                                                                                                                   | Root cause                                                                                                                                                                                                                        | File:line                                                                                                   | Severity             |
| --- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------- |
| A1  | Converted client disappears from rep's list                                                                               | `ClientsService.create` left `accountManagerId = NULL`; OWN-scope filter is `{accountManagerId: rep.id}` so NULL is excluded                                                                                                      | `clients/clients.service.ts:83` (fix is in working tree, **uncommitted**)                                   | P1                   |
| A2  | Lead can vanish from creator's own list right after creation                                                              | `LeadsService.create` can leave `assignedToId = NULL`; OWN-scope leads filter is `{assignedToId: rep.id}`                                                                                                                         | `leads/leads.service.ts:206,254`                                                                            | P2                   |
| B1  | RFQ shows in Pipeline but not RFQ page                                                                                    | RFQ list is row-scoped to `{originalSalesRepId: self}`; `requestRfq` stamps `originalSalesRepId = lead.assignedToId ?? actor`. If the lead's assignee ≠ the actor, the RFQ is owned by someone else and is hidden from the actor. | `leads/leads.service.ts:84,178` + `auth/scope.util.ts:65`                                                   | P1                   |
| B2  | (amplifier of B1) Pipeline shows it anyway                                                                                | Pipeline list applies **no** row-level scope at all                                                                                                                                                                               | `pipeline/pipeline.service.ts:128`                                                                          | P1                   |
| C1  | Leads/clients disappear on module re-entry + API error                                                                    | `accessToken` not persisted + **no single-flight refresh**: two concurrent 401s each call rotating single-use `/auth/refresh`; the 2nd refresh fails ("Refresh token not found") → `clearSession()`                               | `web/src/lib/auth.ts` partialize + `web/src/lib/api-client.ts` 401 handler + `auth/auth.service.ts:101-112` | P1                   |
| D1  | New RFQ is invisible to the department manager who must assign pricers                                                    | Manager RFQ scope only matches RFQs that **already have** an assignment to a dept member; a freshly-created RFQ has zero assignments → chicken-and-egg                                                                            | `rfqs/rfqs.service.ts:134-149`                                                                              | P1 (blocks journey)  |
| D2  | Service selection is free text, not routed                                                                                | `requestRfq` takes `departmentIds[]` but only appends their names to `projectScope` text; nothing structured, no routing, no notification                                                                                         | `leads/leads.service.ts:75-82,165-167`                                                                      | P1 (missing feature) |
| E1  | "Converted leads" report throws / never matches                                                                           | Reports query `status: 'CONVERTED'` but `LeadStatus` has no `CONVERTED` value                                                                                                                                                     | `reports/definitions/sales.definitions.ts:195,202`                                                          | P2                   |
| F   | Broad IDOR class: any non-ALL user can read/mutate other users' leads/clients/quotes/RFQs/projects/pipeline/finance by id | Detail (`findOne`) and all by-id mutations ignore scope; only list queries are scoped                                                                                                                                             | 42 confirmed P1 across 9 modules (see §5)                                                                   | P1 (security)        |

**The unifying theme:** row-level scope was bolted onto **list** queries only. Ownership stamping on **create/convert** is inconsistent, and **detail-read + mutate-by-id** enforce no scope at all. Every reported "disappears" symptom is a different facet of that one architectural gap.

---

## 1. Cluster A — "record disappears from my list after I create/convert it" (owner stamping)

### A1. Converted client disappears

**Current state.** `clients/clients.service.ts:45 create()`:

```ts
accountManagerId: dto.accountManagerId ?? actorId,   // <-- working tree (FIX, uncommitted)
// committed HEAD was: accountManagerId: dto.accountManagerId,   // <-- NULL when dialog omits it
```

The convert dialog (`web/.../leads/[id]/convert-dialog.tsx`) posts `fromLeadId` but no `accountManagerId`. Clients list scope (`clients.service.ts:114`) = `ownerScopeFilter(ctx,'accountManagerId')` → OWN → `{accountManagerId: rep.id}`. A NULL owner never matches → the client is created but invisible to its creator.

**Gap.** The fix exists in the working tree but is **not committed**. A clean checkout/deploy still has the bug.

**Spec.**

1. Commit the working-tree fix (`accountManagerId: dto.accountManagerId ?? actorId`).
2. Confirm the same owner-default on the `requestRfq` client-creation path (`leads.service.ts:111` already uses `accountManagerId: ownerId` — keep, but see B1 for what `ownerId` must be).
3. Backfill: any existing `Client` with `accountManagerId IS NULL` should be assigned to its `createdBy` (one-off SQL migration), else already-converted clients stay invisible.

**Acceptance.** As Ghadah (Sales Rep), convert a lead → land on the client → return to `/clients` → the new client is in the list. A second rep does **not** see it.

### A2. Lead can vanish from its creator

**Current state.** `leads.service.ts:206,254`: `effectiveAssigneeId = dto.assignedToId ?? pickAssignee() ?? undefined`. With auto-assign `off` (the default, `assignment.service.ts getStrategy()`), a rep-created lead has `assignedToId = NULL` and `status = INCOMING`. Leads list scope = `{assignedToId: rep.id}` → the creator can't see their own just-created lead.

**Gap.** Creating a lead does not guarantee the creator can see it.

**Spec.** When a Sales Rep (OWN scope) creates a lead and no assignee is resolved, default `assignedToId = actorId`. Do **not** override an explicit `dto.assignedToId` or an auto-assign pick. Managers/ALL creating on someone's behalf keep current behavior.

```ts
const effectiveAssigneeId =
  dto.assignedToId ?? (await this.assignment.pickAssignee()) ?? actorId; // was: ?? undefined
```

(If the product wants unassigned-queue leads to exist, instead widen the OWN leads filter to `{ OR: [{assignedToId: uid}, {createdBy: uid}] }` — pick one; defaulting the assignee is simpler and matches "salesperson owns it".)

**Acceptance.** Rep creates a lead with no assignee → it appears in their `/leads` list immediately.

---

## 2. Cluster B — RFQ "shows in Pipeline but not RFQ page" (ownership + pipeline scope)

### B1. RFQ owned by the wrong person

**Current state.** `leads.service.ts:84`: `const ownerId = lead.assignedToId ?? actorId;` then `rfq.originalSalesRepId = ownerId` (`:178`), `pipelineEntry.ownerId = ownerId` (`:153`), `client.accountManagerId = ownerId` (`:111`). RFQ list (`rfqs.service.ts:151` → `rfqScopeFilter` OWN, `scope.util.ts:65`) = `{originalSalesRepId: self}`. If `lead.assignedToId` is a different rep than the actor (auto-assign round-robin can assign to any rep or the Sales Manager — `assignment.service.ts REP_ROLES`), the RFQ is owned by that other rep and **invisible to the actor** who raised it.

**Product decision (confirmed by owner):** _the salesperson owns the client._ So the RFQ for a client must be owned by that client's salesperson, and a rep should only raise RFQs on their own leads/clients.

**Spec.**

1. In `requestRfq`, resolve the owner as the **owning salesperson**, preferring the client's account manager, then the lead assignee, then the actor:
   ```ts
   const ownerId =
     existingClient?.accountManagerId ?? lead.assignedToId ?? actorId;
   ```
   In the normal flow (rep owns their lead+client) this equals the actor, so the RFQ is visible to them.
2. Enforce scope on the lead in `requestRfq` (see Cluster F): a non-ALL actor may only raise an RFQ on a lead they own (`assignedToId === actor` or they manage it). This makes the cross-rep mismatch impossible by construction.
3. Widen the OWN RFQ scope so the **raiser** keeps visibility even when a manager raised it on a rep's behalf (defense in depth). `originalSalesRepId` stays the primary owner; `createdBy` is already stamped to the actor (`leads.service.ts:179`):
   ```ts
   // scope.util.ts rfqScopeFilter OWN branch
   return {
     OR: [{ originalSalesRepId: ctx.user.id }, { createdBy: ctx.user.id }],
   };
   ```

**Acceptance.** As Ghadah, raise an RFQ on her own lead → it appears on `/rfqs`. The `originalSalesRepId` on the created RFQ equals Ghadah's id. Verify with:

```sql
SELECT r."rfqNumber", r."originalSalesRepId", u.email, r."createdBy"
FROM rfqs r LEFT JOIN users u ON u.id = r."originalSalesRepId"
WHERE r."clientId" = (SELECT id FROM clients WHERE "contactName" ILIKE '%امجد%' LIMIT 1);
```

### B2. Pipeline list is unscoped (the amplifier + a leak in its own right)

**Current state.** `pipeline.service.ts:128 listEntries(filter)` takes no `scopeCtx` and applies no `ownerScopeFilter`. Every user with `pipeline:view` sees the entire company pipeline. This is why the entry showed in Pipeline while the RFQ (correctly scoped) did not.

**Spec.** Thread `scopeCtx` into `listEntries` and apply `ownerScopeFilter(ctx,'ownerId')`, consistent with leads/clients. Update `pipeline.controller.ts` list route to pass `@CurrentUser()` + `@CurrentScope('pipeline:view')`. Also scope `findOne`, `updateEntry`, `moveStage`, `deleteEntry`, `listVisits`, `listTargets` (see Cluster F).

**Acceptance.** A Sales Rep sees only their own pipeline entries; two reps' pipelines don't bleed into each other; the owned RFQ and its pipeline entry are now consistently visible to the owner.

---

## 3. Cluster C — login works, module re-entry breaks (auth/session)

### Root cause (two compounding defects)

**Defect C1a — `accessToken` not persisted.** `web/src/lib/auth.ts` zustand `persist.partialize` stores only `{user, refreshToken, isAuthenticated}`. On any full reload/rehydrate the app believes it is logged in (`isAuthenticated: true`) but `accessToken === null`, so the first wave of API calls go out with **no Authorization header** → 401.

**Defect C1b — no single-flight refresh, against a single-use rotating refresh token.**

- Access token TTL = **15m** (`config/auth.config.ts:5`).
- `/auth/refresh` is single-use rotating: `auth.service.ts:101-112` does `refreshToken.findUnique({where:{token}})`, **deletes it**, and issues a brand-new pair. A reused/old token → `UnauthorizedException('Refresh token not found')`.
- The Clients page fires `useClientsList` + `useClientStats` **concurrently** (`web/.../clients/page.tsx`). When the access token is expired/missing, both 401 at once. The axios response interceptor (`api-client.ts`) handles each 401 independently (`originalRequest._retry` is per-request), so **both** call `refreshAccessToken()` with the same `R0`. First call deletes `R0`, returns `R1`. Second call sends `R0` → "not found" → the `catch` runs `clearSession()` + `window.location.href = '/login'`.

Net: works right after login (fresh token), breaks on return after the token expires or after a reload — exactly the reported behavior: _"clients disappear and I get an API error."_

### Spec

**Fix C1b (primary) — single-flight refresh.** Serialize concurrent refreshes behind one shared promise; queued requests await it and replay with the new token.

```ts
// api-client.ts
let refreshPromise: Promise<void> | null = null;
async function refreshOnce() {
  if (!refreshPromise) {
    const { useAuthStore } = await import('./auth');
    refreshPromise = useAuthStore
      .getState()
      .refreshAccessToken()
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}
// in the 401 branch: await refreshOnce(); then read the (now-updated) token and retry.
```

This guarantees the rotating refresh token is consumed exactly once per cycle, no matter how many requests 401 simultaneously.

**Fix C1a (supporting) — survive reload.** Either:

- (preferred) persist `accessToken` too (`partialize` add `accessToken`), accepting it lives in localStorage like the refresh token already does; **or**
- proactively refresh on app boot: if `isAuthenticated && !accessToken`, call `refreshOnce()` before issuing data queries (gate the dashboard layout on it).

Pick one; persisting the access token is the smaller change and removes the token-less first-wave entirely.

**Hardening (optional, recommended).** Make `/auth/refresh` tolerant of a one-step-stale token (short reuse grace window or a `replacedById` chain) so a lost race degrades to a retry instead of a logout. Not required if single-flight lands.

### Acceptance

1. Log in, wait > 15 min (or set `JWT_EXPIRES_IN=30s` locally), open `/clients` → data loads via a single transparent refresh; **no** logout, **no** error toast.
2. Hard-refresh (F5) on `/clients` while logged in → stays logged in, data loads.
3. Network tab shows **one** `/auth/refresh` per expiry cycle even with list+stats firing together.

---

## 4. Cluster D — RFQ routing & assignment model (the product owner's flow)

### 4.1 Target model (as described)

```
Sales rep (owns the client) raises an RFQ
        │  multi-SELECT one or more SERVICES (not free text)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ Routing decision driven by the selected service categories         │
│                                                                    │
│  SINGLE service ─────────────► Manager of THAT service's dept       │
│     manager may:                                                    │
│       • price it himself, or                                        │
│       • reply to sales rep with extra requirements (doc request), or│
│       • assign an engineer of the dept to price it                  │
│     engineer may:                                                   │
│       • create the price section, or                                │
│       • reply to sales rep with extra requirements, or              │
│       • request a site visit (rep is the client contact)            │
│                                                                    │
│  MULTIPLE services ──────────► Managers of ALL selected depts        │
│     each manager assigns pricer(s) from their dept                  │
│     ONE assignee is designated Lead Pricer to COMPILE everything    │
└─────────────────────────────────────────────────────────────────┘
        ▼
Lead Pricer assembles the consolidated Quote → approval → send → won → project
```

### 4.2 Current state (what already exists — reuse it)

- **Multi-select UI**: `web/.../leads/[id]/request-rfq-dialog.tsx` already renders service-category checkboxes (`departmentIds: string[]`) + requires a free-text `serviceType` and `projectScope`.
- **One-click create**: `leads.service.ts requestRfq()` creates client (if needed) + READY_FOR_RFQ pipeline entry + RFQ (status RECEIVED) in one transaction.
- **Per-department assignment + Lead Pricer**: `rfq-assignments.service.ts` (`createAssignment`, `updateAssignment`, single-Lead-Pricer invariant, `getLeadPricer`), model `RfqAssignment` (`schema.prisma:1171`, `@@unique([rfqId, departmentId])`, `isLeadPricer`). `RfqAssignment.departmentId` → **ServiceCategory** (note: not the org `Department`).
- **Engineer → sales replies**: `RfqDocRequest` (extra requirements) and `RfqSiteVisitRequest` exist with full CRUD (`rfq-assignments.*`).
- **Manager-action unlock**: `permission.guard.ts MANAGER_ACTION_KEYS` unlocks `rfq:assign_pricers` / `rfq:set_lead_pricer` for a user who is a `Department.managerId`.
- **Quote compile**: `QuoteItem.departmentId` → ServiceCategory; one Quote can hold items from many departments; approval/payment-100%/send/won/convert-to-project all exist (`quotes.service.ts`).
- **Org mapping table**: `DepartmentService` (`schema.prisma:2202`) links `Department` ↔ `ServiceCategory`; `Department.managerId` → User. **This join is currently used nowhere in routing.**

### 4.3 Gaps (what's missing)

| Gap                                                   | Detail                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D2 — structured service selection**                 | `departmentIds[]` are only appended as text to `projectScope` (`leads.service.ts:165-167`). No structured column, no routing consequence. `serviceType` is still a required free-text field.                                                                                                                        |
| **D1 — manager can't see the new RFQ**                | Manager RFQ scope (`rfqs.service.ts:134-149`) only returns RFQs that already have an assignment to a dept member. A new RFQ has zero assignments → invisible to the very manager who must assign pricers. Chicken-and-egg. The `ServiceCategory→Department` mapping (`DepartmentService`) is not consulted.         |
| **D3 — no auto-routing / notification**               | `requestRfq` notifies nobody. No manager inbox, no "RFQ received" event. Single vs multi-service produces identical (no) routing.                                                                                                                                                                                   |
| **D4 — no Lead Pricer auto-rule**                     | For a single service, the sole assignee should be the Lead Pricer automatically. For multi-service, nobody is designated to compile until a human toggles it; and the spec for _who_ designates is unimplemented.                                                                                                   |
| **D5 — pricing section content not modeled**          | `RfqAssignment` records who/status/notes but not the priced line items of that department's section. "Engineer submits their section" today just means status=SUBMITTED; the actual prices live in a single Quote built by whoever opens the builder. There is no per-department section the Lead Pricer assembles. |
| **D6 — ServiceCategory vs Department reconciliation** | `RfqAssignment.departmentId` and `Quote.departmentId` are `ServiceCategory` ids; `user.departmentId` / `managedDepartment` are org `Department` ids. Routing and "is this assignee in my department" must bridge them through `DepartmentService`. (Flagged in readiness doc §3.3.)                                 |

### 4.4 Spec

**Schema (Prisma) additions:**

1. `Rfq.requestedCategoryIds String[] @default([])` — the ServiceCategory ids the rep selected. (Array column; alternatively a `RfqRequestedCategory` join if you need per-category status/timestamps — array is enough for routing + visibility.)
2. (For D5, choose one)
   - **Light:** keep a single Quote per RFQ; each pricer adds `QuoteItem`s tagged with their `departmentId`; mark their `RfqAssignment.status = SUBMITTED` when done; Lead Pricer reviews + submits the whole Quote. No new model.
   - **Explicit:** add `RfqPricingSection { id, rfqId, departmentId (ServiceCategory), assigneeId, status, lineItems Json, subtotal, submittedAt }`, and have the Lead Pricer assemble these into the Quote. More faithful to "submit your section → compile", more work.
   - Recommendation: **Light** for v1; revisit Explicit if sections need independent approval/versioning.

**API / service changes:**

1. **`requestRfq`** (`leads.service.ts`):
   - Validate the actor owns the lead (Cluster F scope check) — non-ALL actors only on their own leads.
   - Persist `rfq.requestedCategoryIds = dto.departmentIds`.
   - Make `serviceType` optional/derived: default it to the joined names of the selected categories if the rep leaves it blank (the dialog can drop the free-text requirement).
   - **Route + notify** after creating the RFQ:
     - Resolve `Department`s for the selected categories: `DepartmentService where serviceCategoryId in requestedCategoryIds` → `department.managerId`.
     - For each resolved department manager, send a `rfq.received` notification (deep link `/rfqs/:id`).
     - If `requestedCategoryIds.length > 1`, also notify the Sales Manager (and/or Technical Director) who designates the cross-dept Lead Pricer.
   - Set `rfq.status = ASSIGNED`? No — keep `RECEIVED` until a pricer is assigned; "received by managers" is conveyed by visibility (below) + notifications. (Or add a `ROUTED` status if you want an explicit state; optional.)
2. **Manager visibility (fix D1)** — `rfqs.service.ts list()` DEPARTMENT branch: a manager should see RFQs where **either** an assignment exists to a dept member (existing) **or** `rfq.requestedCategoryIds` intersects the ServiceCategories their department offers:
   ```ts
   // resolve the manager's ServiceCategory ids via DepartmentService
   const cats = await prisma.departmentService.findMany({
     where: { departmentId: managedDeptId },
     select: { serviceCategoryId: true },
   });
   const catIds = cats.map((c) => c.serviceCategoryId);
   where.AND = [
     {
       OR: [
         { assignments: { some: { assigneeId: { in: deptMemberIds } } } },
         { requestedCategoryIds: { hasSome: catIds } }, // <-- new: routed-but-unassigned
       ],
     },
   ];
   ```
   This makes a freshly-routed RFQ visible to exactly the managers who must act on it.
3. **Lead Pricer auto-rule (D4)** — `createAssignment`: if after creating an assignment the RFQ has exactly one assignment, set `isLeadPricer = true` on it automatically. For multi-dept, leave designation to the Sales Manager/Technical Director via `updateAssignment {isLeadPricer:true}` (already enforces single-lead invariant).
4. **Engineer/manager actions** — already exist (`createDocRequest`, `createSiteVisitRequest`, assignment status, quote build). Add scope checks (Cluster F): an assignee may only act on RFQs they're assigned to; a manager only within their department's categories.
5. **Compile** — Lead Pricer builds/owns the consolidated Quote (existing `quotes.create` with items tagged by `departmentId`); link via `rfq.quoteId` (existing `linkQuote`). Block `submitForApproval` until every `RfqAssignment.status === SUBMITTED` (extend the existing `submitForApproval` guard in `rfqs.service.ts:247`).

**Frontend changes:**

- `request-rfq-dialog.tsx`: keep multi-select services; drop the free-text `serviceType` requirement (derive from selection) or keep it optional.
- Add a department-manager **RFQ inbox** view (filter `/rfqs` by "needs my assignment": routed to my dept categories, no assignment yet).
- RFQ detail: per-department assignment panel (assign pricer, toggle Lead Pricer), doc-request + site-visit-request threads (wire to existing endpoints).

### 4.5 Acceptance

1. Rep selects **one** service → that service's department **manager** sees the RFQ in their list **before** any assignment exists, and is notified.
2. Manager assigns an engineer → engineer sees it; engineer can submit a section, raise a doc request, or request a site visit; all three land back on the **sales rep**.
3. Rep selects **multiple** services → **all** relevant department managers see + are notified; each assigns a pricer; one assignee is Lead Pricer; the Lead Pricer can submit for approval only after all sections are SUBMITTED.
4. Single-service RFQ auto-designates its sole assignee as Lead Pricer.

---

## 5. Cluster F — RBAC row-level scope enforcement (the IDOR class)

An automated 9-module audit (adversarially verified) found **42 P1, 22 P2, 6 P3** confirmed gaps. The pattern is identical everywhere: **list queries are scoped; detail-read and mutate-by-id are not.** A non-ALL user (e.g. Sales Rep at OWN scope) can read or mutate any other user's record by id/number.

### 5.1 Recommended fix shape (do this once, apply everywhere)

Add scope enforcement at the **object** level, not just the list. Two options:

- **Helper (minimal):** a `assertCanAccess(entity, ctx, ownerField)` used inside each `findOne`/mutation that throws `ForbiddenException` when `ctx.scope !== 'ALL'` and `entity[ownerField] !== ctx.user.id` (or, for DEPARTMENT, not in the user's dept). Pass `scopeCtx` from every controller route (add `@CurrentUser()` + `@CurrentScope(key)` to the routes that currently omit them).
- **Guard/interceptor (systematic):** a `ScopedResourceGuard` that loads the target entity by id and checks ownership against `request.permissionScopes`. More upfront work, but kills the whole class and prevents regressions.

Recommendation: **helper now** (fast, unblocks the journey test), **guard next** (durable). Whichever you choose, the controllers currently pass scope to `findAll` only — extend to `findOne` + every by-id mutation.

### 5.2 Confirmed P1 findings (object-level IDOR) — fix all

**leads** (`leads/leads.service.ts`)

- `:401` `findOne` — IDOR read of any lead by id (c10)
- `:415` `findByNumber` — enumerable IDOR read (LEAD-YYYY-XXXX is sequential) (c10)
- `:429` `update` — IDOR write (c10)
- `:457` `assign` — IDOR write / lead theft (reassign any lead to self) (c10)
- `:303` `autoAssign` — IDOR write (c9)
- `:492` `updateStatus` — IDOR write (disqualify/qualify others' leads) (c9)
- `:527` `softDelete` — IDOR write (archive others' leads) (c9)
- `:70` `requestRfq` — IDOR write driving the sales journey (c9) — also see B1
- `:673` `listInteractions` — leaks any lead's comms log (c9)

**clients** (`clients/clients.service.ts`)

- `:179` `findOne` (c10) · `:200` `update` (c10) · `:225` `archive` (c10) · `:236` `classify` (c9) · `:477` `reassign` (c9) · `:330` `addInteraction` (c8) · `:288` `listInteractions/listNotes/listFollowUps` leak child records (c8)

**quotes** (`quotes/quotes.service.ts`)

- `:248` `findOne` (c10) · `:257` `update` (c9) · `:836` `softDelete` (c9) · `:368` `submit` (c8) · `:671` `accept/reject/postpone/setFollowUpStatus/send` (c9)

**rfqs** (`rfqs/rfqs.service.ts`, `rfq-assignments.service.ts`)

- `:186` `findOne` cross-rep IDOR read (c10) · `:372` `cancel` scope-blind (c9) · `:235` `startPreparation` scope-blind (c8) · assignments `:281` child collections bypass parent-RFQ scope (c9)

**projects** (`projects/projects.service.ts`, `licences.service.ts`)

- `:228` `findOne` (c10) · `:237` `update` (c9) · `:256` `transitionStatus` (c9) · `:348` phase mutations (c9) · `:459` task mutations (c9) · `:560` closure routes (c8) · licences `:56` list (c9) · `:101` licence create/update/delete + override (c8)

**pipeline** (`pipeline/pipeline.service.ts`)

- `:167` `findOne` (c10) · `:128` `listEntries` unscoped (c10, = B2) · `:191` `updateEntry` (c10) · `:210` `moveStage` (c10) · `:313` `deleteEntry` (c10) · `:426` `updateVisit` (c9) · `:411` `listVisits` (c9)

**reports** (`reports/reports.service.ts`) + **bpd**

- `:52` report execution applies zero row-level scope → non-ALL `reports:view` holders see org-wide data (c9)
- `bpd.definitions.ts:203` TENDER_TRACKER admits SALES_REPRESENTATIVE yet lists ALL tender leads unfiltered (c10)

### 5.3 Confirmed P2 (data-consistency / leaks) — fix in same pass

- **Phantom enum (E1):** `reports/definitions/sales.definitions.ts:195,202` queries `status: 'CONVERTED'` / `status: { in: ['QUALIFIED','CONVERTED'] }` but `LeadStatus` (schema:373) has no `CONVERTED`. Runtime throw + the conversion metric never matches. **Decide the data model:** either add a `CONVERTED` lead status and set it on convert (recommended — the journey has no explicit converted state today; conversion overloads `QUALIFIED`), or rewrite the report to use `QUALIFIED` + `clientId IS NOT NULL`. The convert dialog UI even says "marked CONVERTED" (`convert-dialog.tsx`) — currently false.
- **`stats()` global while list is scoped** across leads `:535`, clients `:247`, quotes `:1028`, rfqs `:386`, projects `:745`, pipeline `:318` — a Sales Rep's KPI cards show org-wide totals that don't match their scoped list. Scope `stats()` to match, or document them as intentionally global.
- **finance** module list+mutate routes (`finance.service.ts` invoices `:156`, payments `:221`, confirmations `:36`, commissions `:468`; mutations `:303,:56,:486`) take no `scopeCtx` at all.
- **owner stamping (C5):** leads `:206` (A2), rfqs `:93` create stamps `originalSalesRepId` from nullable `opportunity.ownerId` not the actor.

### 5.4 Acceptance

1. As Sales Rep A, `GET /leads/:id`, `/leads/number/LEAD-...`, `/clients/:id`, `/quotes/:id`, `/rfqs/:id`, `/pipeline/entries/:id` for a record owned by rep B → **403** (not 200).
2. As Sales Rep A, every by-id mutation on rep B's records → **403**.
3. KPI counts equal the scoped list counts for a non-ALL user (or are explicitly documented as global).
4. The "converted leads" report runs without error and returns the right rows.

---

## 6. Sequencing (recommended)

```
P0 (unblock the journey test, smallest diffs):
  1. Commit A1 (accountManagerId default) + backfill NULL owners.
  2. A2 (default lead assignee to creator).
  3. C1 (single-flight refresh + persist accessToken).   <- stops random logouts
  4. B1 + B2 (RFQ owner = owning salesperson; scope the pipeline list).
  5. E1 (CONVERTED phantom enum — pick add-status or rewrite-report).

P1 (security hardening — same release):
  6. Cluster F: object-level scope helper + thread scopeCtx into every findOne
     and by-id mutation across leads/clients/quotes/rfqs/projects/pipeline/finance.

P2 (the RFQ routing feature):
  7. D2 requestedCategoryIds + drop free-text serviceType requirement.
  8. D1 manager visibility via DepartmentService mapping.
  9. D3 routing notifications (single vs multi-dept).
 10. D4 Lead Pricer auto-rule + submit-gate on all-sections-SUBMITTED.
 11. Frontend: manager RFQ inbox + per-dept assignment panel.
```

Lanes 6 (RBAC) and 7-11 (routing) are largely independent and can run in parallel worktrees; both depend on P0 landing first. E1's "add CONVERTED status" choice should be made before 7 (it affects the lead state machine).

## 7. Test coverage note

`packages/api/src` currently has **0 spec files**. The only verification is `scripts/rbac_verify.js` (offline) + `scripts/rbac_verify.sql` (live). Every fix above must ship with tests:

- Scope unit tests for `scope.util.ts` (OWN/DEPARTMENT/ALL × leads/clients/quotes/rfqs/projects/pipeline) including the new object-level helper.
- e2e: cross-rep 403 matrix (§5.4), convert-to-client visibility (§1), RFQ owner + visibility (§2), refresh-race no-logout (§3.acceptance.3), single→manager and multi→managers routing (§4.5).

## 8. Appendix — verification commands

```bash
# A1: any orphaned clients still invisible?
docker exec -i abak-db psql -U abak -d abak_erp -c \
 "SELECT count(*) FROM clients WHERE \"accountManagerId\" IS NULL AND \"deletedAt\" IS NULL;"

# B1: who owns the امجد RFQ?
docker exec -i abak-db psql -U abak -d abak_erp -c \
 "SELECT r.\"rfqNumber\", u.email AS owner, r.\"createdBy\" FROM rfqs r
  LEFT JOIN users u ON u.id=r.\"originalSalesRepId\"
  WHERE r.\"clientId\" IN (SELECT id FROM clients WHERE \"contactName\" ILIKE '%امجد%');"

# C1: confirm token TTL + refresh rotation
grep -n "jwtExpiresIn\|refreshExpiresIn" packages/api/src/config/auth.config.ts
sed -n '92,120p' packages/api/src/modules/auth/auth.service.ts   # single-use delete

# E1: confirm phantom enum
grep -n "CONVERTED" packages/api/src/modules/reports/definitions/sales.definitions.ts
grep -n "enum LeadStatus" -A12 prisma/schema.prisma
```

Full machine-readable audit findings (42 P1 / 22 P2 / 6 P3 with per-line quoted evidence) were produced by the scope-audit workflow; re-run available on request.
