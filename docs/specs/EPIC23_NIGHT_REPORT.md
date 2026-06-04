# EPIC 2/3 — Autonomous Overnight Run · Morning Report

**Run window:** night of 2026-06-04. Unsupervised. Live env (API :3011, web :3000,
Postgres :5435) kept up throughout. No pushes. No migrations / schema / backend-write
changes (per guardrails).

## STATUS: DONE_WITH_CONCERNS

EPIC 2 (Sales "My Requests") **complete + live-verified**. EPIC 3 (Quotations board)
**core complete + live-verified** (the Incoming→Accept→Pricing seam + decline);
depth items QP-5/6/7/8/9 **deferred with reasons** (one is backend-blocked). Two
backend findings logged, not fixed overnight.

**Recommended first action for morning:** unblock the Accept sheet for real managers
— **RV2-1**: a Department Manager can't list pricers because `GET /users` needs
`users:view` (which managers lack), so the UserPicker is empty. Grant managers
`users:view` or add a department-scoped member endpoint. That's the one thing
between the verified seam and a manager-usable accept.

---

## Commits this run (newest first)

| Commit    | Issue           | One-liner                                                                   |
| --------- | --------------- | --------------------------------------------------------------------------- |
| `05000b8` | RV2-6           | Gate the Quotations board to managers (sales rep → List only)               |
| `cec3fcd` | QP-1,2,3,4,10   | Quotations department board — Incoming→Accept→Pricing seam                  |
| `2d8a1b2` | SALES-6         | Client engagement sub-states (IN_DISCUSSION / IN_NEGOTIATION) on quote card |
| `5e81e38` | SALES-5 (RV-24) | Reroute-after-decline UI (reason + edit services + resubmit)                |
| `80636cd` | SALES-4         | Quote card actions — send + record outcome (Won/Lost/Postpone)              |
| `5a42fa1` | SALES-3         | Open Asks responder — doc upload + site-visit confirm (DM-13)               |
| `ca247bd` | SALES-2         | Rebuild RFQ detail as single-scroll sales tracker                           |

(SALES-1 / STEP-0 / openAskCount serializer landed earlier in the same session:
`66bb860`, `a0b5cef`, `c2ddfc2`, `89bc289`, `33e5474`.)

**Roadmap boxes ticked:** SALES-2, SALES-3, SALES-4, SALES-5, SALES-6, RV-24,
QP-1, QP-2, QP-3, QP-4, QP-10.

---

## Test matrix

| Check                                           | Result                                                  |
| ----------------------------------------------- | ------------------------------------------------------- |
| `nx typecheck web`                              | **0 errors**                                            |
| `nx typecheck api`                              | **0 errors**                                            |
| `nx test shared-utils`                          | **pass**                                                |
| `nx test api`                                   | **pass** (4/4; web-only changes, no api source touched) |
| web lint (lint-staged: prettier + eslint --fix) | **green on every commit**                               |
| web production build                            | not run (slow; typecheck + lint green)                  |

### End-to-end Playwright walks (real role users, not Super Admin)

**Sales loop — ghadah@abak.com.sa (Sales Rep):**

- track tracker render — **PASS**
- respond to doc ask: upload PNG → `POST /files/upload` 201 (bytes intact) → PATCH RESOLVED 200 → openAskCount 2→1, list chip dropped — **PASS**
- respond to site-visit ask: wrote `accessContactName`/`accessContactPhone` (DM-13) + scheduledAt → RESOLVED → count→0, card self-hid — **PASS**
- send quote: APPROVED → confirm → `/send` 200 → SENT, timeline advanced — **PASS**
- record outcome: Lost (reason COMPETITOR + note) → `/reject` 200 → closed read-only — **PASS**
- engagement: SENT → "In discussion" → `/in-discussion` 200 → chip active — **PASS**
- reroute: WRONG_DEPT decline → edit services → resubmit (400 unroutable handled inline → wired routable cat → 201) → back to SUBMITTED, card self-hid — **PASS**
- raise (create RFQ from lead) — **NOT re-tested** (pre-existing `useCreateRfq`, unchanged this run)

**Department loop — hassan@abak.com.sa (Dept Manager) + Super Admin for the picker:**

- Board renders (5 RTL columns, KPIs, SLA timers, accept/decline) for hassan — **PASS**
- accept+assign seam: 2 dept rows + single ⭐ lead → assignments 201+201 → `start-pricing` 201 → QUO-2026-0004 DRAFT with 2 dept sections + one lead → rfq PRICING → card moved Incoming→Pricing live — **PASS** (as Super Admin; see RV2-1)
- decline: reason + note → `/decline` 201 → card left Incoming — **PASS**
- price sections → compile → submit → approve → send — **NOT walked** (QP-5/6 deferred; approve/send already live on the pre-existing quote-detail toolbar)

### Role-gating (verified with real role users)

- **Sales Rep** zero assign/pricing on /rfqs; /quotes = List only, no Board (RV2-6 fix) — **PASS**
- **Engineer** (hashim.ali, TECHNICAL_MANAGER) object-scope-denied the sales tracker; lacks `quote:send`/`quote:set_outcome` (can()-gated) — **PASS**
- **Dept Manager** (hassan) sees Board + accept/decline (assign-gated) — **PASS**

---

## Decisions made (full rationale in EPIC23_NIGHT_DECISIONS.md)

- **Role test users**: used ghadah (real Sales Rep) as primary, hashim.ali (engineer) for the negative gate, hassan (Dept Manager) + Super Admin for the board. The brief's `rep1@` is an equivalent Sales Rep; ghadah was already verified end-to-end.
- **SALES-5 reroute** shown only for WRONG_DEPT (backend forbids reroute for NO_BID); NO_BID renders read-only. Also fixed a latent timeline bug (NO_BID was borrowing the WRONG_DEPT "re-route" copy).
- **EPIC 3 scope**: shipped the spec-central Board + seam; deferred the deep/blocked depth items.
- **EPIC 3 committed as one board commit** (not 5): the shared `quotations` i18n namespace can't be partially staged without interactive git (`git add -p` is disallowed), and the components form one verified feature. All 5 QP boxes enumerated in the commit body.

## Review findings (RV2-n) — see EPIC23_REVIEW.md

- **Fixed:** RV2-6 (board gated to managers).
- **Left (backend, overnight guardrail):** RV2-1 (manager can't list pricers — `users:view`), RV2-2 (duplicate assignment 500-not-409).
- **Left (deferred features):** RV2-4 (scope control), RV2-5 (List # RFQ/Stage columns), RV2-3 (true business-hours SLA).

## Deferred / stubbed / blocked (the morning checklist)

| Item                                                                            | Why deferred                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **QP-6** Lead Reviewer compile + section submit-gate                            | **BACKEND-BLOCKED** — no department-section endpoints (list / submit-to-lead / request-revision) exist; the §14 gate needs new write endpoints, which the overnight guardrail forbids. **Do this first on the backend.** |
| **QP-5** `<DraftQuoteCard>` + `/quotes/[id]/build` pre-linked builder edit-mode | Large (new route + builder parameterisation: locked client, per-dept locked sections). Board's Pricing card links to `/quotes/[id]` for now.                                                                             |
| **QP-7** Re-site requests panel into Pricing                                    | Panel already renders on `/quotes/[id]` (spec §6.1); minor.                                                                                                                                                              |
| **QP-8 / QP-9** (P2)                                                            | Staleness signal; un-accept UI (`useUnacceptRfq` exists, wire a button on the Pricing card).                                                                                                                             |
| **RV2-1 / RV2-2**                                                               | Backend writes — not done overnight by design.                                                                                                                                                                           |
| Backend change a screen wanted but I did **not** make                           | The Accept sheet wants managers to list department members (RV2-1); and a `Quote.rfqNumber` serializer field for the List `# RFQ` column (RV2-5). Both deliberately left for a supervised backend change.                |

## Test data mutated (dev DB — all recoverable test state)

Seeded/!! for verification: doc + site-visit requests on RFQ-2026-0003 (resolved);
QUO-2026-0003 cycled APPROVED→SENT→LOST→SENT→IN_DISCUSSION; RFQ-2026-0002
declined→rerouted→accepted into QUO-2026-0004 (PRICING); RFQ-2026-0001 declined;
one `DepartmentService` link (Consultancy→Architecture) added so reroute/accept had a
routable inbox; 3 stale assignments deleted from RFQ-2026-0002. No production data.
