# EPIC 2/3 — Autonomous Overnight Run · Decision Log

Operator asleep; decisions made unsupervised, spec-grounded. One line rationale each.

## Role test users (gating verification)

- **Sales Rep** → `ghadah@abak.com.sa` (effective role "Sales Rep", 17 perms incl.
  rfq:request, quote:send, quote:set_outcome). The brief suggested `rep1@abak.com`
  (also SALES_REPRESENTATIVE); ghadah is an equivalent real role user already
  verified end-to-end, so I use her as the primary Sales Rep. NOT Super Admin.
- **Engineer (negative gate)** → `hashim.ali@abak.com.sa` (TECHNICAL_MANAGER) — must
  NOT see send/outcome.
- **Sales Manager** → `haitham@abak.com.sa`; **Dept Manager** → `hassan@abak.com.sa`
  (both User.role=ADMIN with manager role-assignments).

## SALES-5 — reroute scope

- Reroute UI is shown ONLY for `DECLINED_WRONG_DEPT`: the backend `reroute()` rejects
  anything but status=DECLINED + declineType=WRONG_DEPT (BadRequestException). For
  `DECLINED_NO_BID` the card renders the decline reason READ-ONLY (terminal) — no
  reroute control. Matches the backend contract; no UI that would always 400.
- Fixed a latent gap found while building: `StatusTimeline` only special-cased
  WRONG_DEPT + CANCELLED, so `DECLINED_NO_BID` fell through to the linear stepper
  (wrong — it's a decline, not in-progress). Added a NO_BID banner branch.

## EPIC 3 (Quotations pipeline) — scope decision

Building the spec-central **department Board** (PART B §1–§5,§7) and the
Incoming→Accept+Assign→Pricing seam, the heart of the surface:

- **QP-1** `<QuotationsShell>` — Board/List view toggle, scope (My queue/My dept/
  All), scope-aware KPIs, search; List view folds the existing `/quotes` table.
- **QP-2** Incoming column + `<IncomingRfqCard>` + business-hours SLA timer.
- **QP-3** `<AcceptAssignSheet>` — per-department UserPicker rows + single-lead
  invariant → POST assignments + `useStartPricing` → builder. (weaves RV-6)
- **QP-4** `<DeclineRfqDialog>` → `useDeclineRfq` (reason type + required note).
- **QP-10** downstream columns (Pricing/In-approval/Sent/Closed) read-only from
  `quote.status` → `/quotes/[id]`. (weaves RV-10/11 — those live on the quote
  detail toolbar, already built.)

**Deferred to morning, with reasons (NOT silently dropped):**

- **QP-5** rich `<DraftQuoteCard>` + `/quotes/[id]/build` pre-linked builder edit
  mode — the board's Pricing card links to the existing `/quotes/[id]`; a true
  edit-mode builder with locked client + per-dept locked sections is its own
  large task (new route + builder parameterisation). Not attempted overnight to
  avoid a half-built builder.
- **QP-6** Lead Reviewer compile view + section submit-gate — **BLOCKED on
  backend**: there are NO department-section endpoints (list/submit-to-lead/
  request-revision) on the quotes controller; the §14 gate needs new write
  endpoints, which the overnight guardrails forbid. Stub + log; do not migrate.
- **QP-7** re-site `<RfqRequestsPanel>` into Pricing — the panel already renders
  on `/quotes/[id]` (spec §6.1); minor re-placement, low value vs. the seam.
- **QP-8 / QP-9** (P2) staleness signal + un-accept UI — `useUnacceptRfq` exists;
  small, deferred to morning checklist.
