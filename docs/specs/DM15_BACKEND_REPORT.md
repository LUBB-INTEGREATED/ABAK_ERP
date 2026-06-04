# DM-15 — Backend Pass · Report

Backend pass that unblocks the department side of the RFQ/Quote restructure: the
manager's pricer-picker (RV2-1) and the §14 lead-reviewer section lifecycle that
QP-5/QP-6 need. NestJS API + live Postgres. **No migration** — every field
already existed in the schema.

## STATUS: DONE — all five items shipped, adversarially reviewed, P1/P2 fixed

9 commits on `main` (`ae03949..HEAD`) — 8 code/test + this report, no push.
`nx typecheck api` (uncached) + full `nx test api` green throughout (16 spec
files). Diff is **api + docs only** — no web, no schema change.

## Per-item results

| Item               | Commit    | What                                                                                                                                                                                                                                                                                                                | Test (live dev Postgres)                                                              |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **DM-15a** (RV2-1) | `870546f` | `GET /departments/:departmentId/members` → members + manager; perm `rfq:assign_pricers`; object-level scope (ALL lists any, DEPARTMENT manager only their own). Own `departments` controller so the manager-action gate isn't shadowed by `admin/departments`' class `departments:view`.                            | 5/5 — manager lists own; cross-dept + non-manager refused; ALL lists any; 404 unknown |
| **DM-15b** (RV2-2) | `42feed7` | `createAssignment` wraps the create in try/catch — P2002 on `@@unique([rfqId,departmentId])` → `ConflictException` (409).                                                                                                                                                                                           | 2/2 — duplicate → 409; distinct dept still 201                                        |
| **DM-15c**         | `732131f` | `startPricing` seeds section `pricerId`/`isLead` from the assignments; create/update mirror onto the section (single-lead invariant); `PATCH …/sections/:id/submit` (DRAFT→SUBMITTED_TO_LEAD); `…/request-revision` (lead bounces back, note on the RfqAssignment + push); `GET /quotes/:id/sections` compile view. | 6/6 + 3 RV3 regressions                                                               |
| **DM-15d**         | `4aebbdd` | `POST/PATCH/DELETE /quotes/:id/requirements`; `POST …/requirements/dedup` (lead merges → `isShared` + `dedupedFromIds`, deletes merged).                                                                                                                                                                            | 4/4 + 3 RV3 regressions                                                               |
| **DM-15e**         | `1b81210` | §14 submit gate in `submit()`: every section `SUBMITTED_TO_LEAD` + only the lead pricer submits.                                                                                                                                                                                                                    | 3/3 + 1 RV3 regression                                                                |

## Adversarial review → fixes (RV3-n)

A 5-dimension review (correctness / auth / wiring) with per-finding verification
raised 15, confirmed 10. All P1/P2 fixed in three commits; cheap P3s folded in.

| Commit    | Findings                       | Fix                                                                                                                                                                                                                                                                                                                                                                                           |
| --------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `4120c0b` | **RV3-1 (P1)**, RV3-2 (P2)     | The §14 gate over-fired: `syncItemSections()` auto-creates a DRAFT section per item-department on **manual** quotes, which the "all sections submitted" check then blocked forever (no UI submits a manual section). Now the gate applies **only when a lead section exists**; manual/auto-sectioned quotes fall through to the normal priced+milestone checks. Lead identity is fail-closed. |
| `7c3b4fe` | **RV3-3/5/6 (P1)**, RV3-4 (P2) | Fail-**open** guard family: `&& pricerId` / absent-lead short-circuits let any `quote:build` holder submit an unassigned section (IDOR), bounce a co-pricer's section, or dedup with no lead. Now fail-closed. `syncSectionFromAssignment` resolves the target section first — a department absent from the quote no longer clears every lead flag (zero-lead bug).                           |
| `f78d3b9` | RV3-7 (P2), RV3-8/9 (P3)       | Requirement CRUD/dedup now require an editable (DRAFT, non-deleted) quote; dedup re-reads `dedupedFromIds` inside its transaction (lost-update race).                                                                                                                                                                                                                                         |

### Deferred (P3, noted not fixed)

- **Requirement `position`** is accepted client-side with no `@@unique(quoteId,position)` — duplicate positions give non-deterministic list ties. Low impact; would want a position-normalisation pass or a unique index (migration).
- **Adding a brand-new department line item to an in-pricing lead-model quote** creates a new DRAFT section that re-blocks submit until it's assigned+submitted. This is the §14 model working as designed; the "add a department mid-pricing" UX is QP-5/QP-6 territory.

## Answers to the brief's report questions

- **Does `QUOTE_INCLUDE` already return sections/requirements for the compile view?**
  **Yes, partially.** `QUOTE_INCLUDE` (quotes.service.ts) returns `departmentSections`
  (with the `department` relation and all section scalars — `status`, `isLead`,
  `pricerId`, `departmentId`, `scopeText*`, `pricingModel`) and the flat
  `requirements` list (ordered by `position`). It does **not** include per-section
  `items` or the resolved pricer **user**. For the full §14 compile view (sections
  with their line items + pricer name), QP-6 should call the new
  `GET /quotes/:id/sections` (DM-15c `listSections`), which adds both. So
  `findOne`/`QUOTE_INCLUDE` is enough for status/lead/pricerId + requirements;
  `listSections` is the richer per-section read.

## Grain tension (flagged, NOT fixed — as instructed)

Implemented sections + assignments key off **`ServiceCategory`** (the
"department" anchor of the 2026-05-21 process correction); people belong to real
**`Department`** rows (RBAC v2: `Department.members`/`managerId`, linked to
ServiceCategory via `DepartmentService`). §14 (split spec) wants `section = real
Department`. DM-15 works **with** the ServiceCategory grain (no re-migration):

- `startPricing` seed + `syncSectionFromAssignment` join `section.departmentId`
  to `RfqAssignment.departmentId` directly — both are ServiceCategory ids, so the
  join is exact within the implemented model.
- The **member endpoint** is the one place the two grains meet: `:departmentId`
  is a real `Department` id; the web Accept sheet must fold the section's
  `ServiceCategory` → owning `Department` (via `DepartmentService`) before
  calling. That fold is a web (QP-3/5) concern.
- `QuoteRequirement` has **no `sectionId`** in the implemented model, so DM-15d's
  dedup is a **flat quote-level** list (lead merges). §14's per-section
  requirement authorship would need a migration — deliberately deferred.

Re-graining sections/assignments to real `Department` is a separate, migration-
bearing decision; DM-15 does not pre-empt it.

## Flag — build-from-clean

`packages/api/src/modules/admin/admin.module.ts` (committed in DM-15a, since the
admin module was previously uncommitted) imports the **still-untracked** admin
sibling controllers from the prior employee-mgmt session
(`admin-users`/`roles`/`permissions-catalog`/`departments.controller` + `dto/`).
The working tree builds (typecheck green); a fresh checkout of these commits would
not until those siblings are committed (or `app.module.ts`'s `AdminModule` wiring
is landed). Pre-existing in-flight condition surfaced by DM-15a — owner of the
employee-mgmt module should commit them.

## Test data

All seed/trash isolated per spec (TEST-DM15x-<ts> tags, `after()` cleanup):
clients, opportunities, RFQs, quotes, sections, requirements, assignments, users.
No production data. No schema change.
