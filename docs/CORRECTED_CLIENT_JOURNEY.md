# ABAK ERP — Corrected Client Journey (v1)

**Status:** Draft — pending client review on 2026-05-21
**Supersedes:** parts of `Process/ABAK_ERP_Module1_LeadCapture_v1.md`, `Module4_Quotation_v1.md`, and the `rfq-engineer` + `pro-government-delegate` persona docs.
**Diagnostic frame:** Don Norman (activity-centered design, gulfs of execution/evaluation, signifiers, error design).
**Scope discipline:** stays inside the 4 contracted modules (Quotations, Project, CRM, Sales). No Client Portal, no PMO, no External Consultant.

---

## 0. What changed in this correction

| Wrong (prior model)                          | Right (this model)                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `RFQ Engineer` role                          | No such role. The pricer is **any engineer or manager inside a department**, picked per-RFQ by the department manager.                      |
| `Government Delegate / PRO` role             | No such role. Government work shows up as **licences inside a normal project**, owned by the engineer running that phase.                   |
| Government tender as a separate lead channel | Removed. Drop the Etimad/Fursa "special tender quote template" flow.                                                                        |
| RFQ Engineer queue + auto-routing            | Department manager triages; manager **assigns a Lead Pricer** (plus optional co-pricers in multi-dept).                                     |
| Sales/engineering split contact with client  | Sales person is the **single thread-of-record**, but engineering may directly coordinate **site-visit logistics** (CC'd to comms log).      |
| Hardcoded discount approval chain            | **Admin-configurable**: tier-based OR sequential, owner = CEO/Admin.                                                                        |
| Phase starts regardless of licence state     | Phase **hard-blocks** when dependent licence ≠ Issued, and the **project timeline pauses** (no slip accrual).                               |
| Quote → Project is a manual re-entry         | Quote → Project is a **1-click conversion**, carrying scope/departments/line-items/payments/docs. Department manager is the notified actor. |

---

## 1. The activities (organize the product around these, not personas)

Norman: _organize the product around the activity, not the persona_. The journey is one continuous activity per client; the eight named sub-activities below are the natural pinch points where state changes and someone hands off.

| #   | Activity                        | Active role(s)                                                                       | Output state                                              |
| --- | ------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| A   | Capture & grow a lead           | Sales Person                                                                         | Lead with comms log + docs                                |
| B   | Request an RFQ                  | Sales Person                                                                         | RFQ submitted; lead → _Qualified_                         |
| C   | Assign the RFQ                  | Department Manager (or Main Manager if multi-dept)                                   | Lead Pricer + optional co-pricers assigned                |
| D   | Price the work                  | Lead Pricer (single-dept) or Lead + co-pricers (multi-dept)                          | Draft quote, possibly with doc/site-visit requests        |
| E   | Approve the quote               | Department Manager → Main Manager → CEO _(per configurable chain & value threshold)_ | Quote ready to send                                       |
| F   | Negotiate & adjust              | Sales Person, with conditional approvers if discount > ceiling                       | Quote signed by client                                    |
| G   | Convert to project              | Department Manager (1-click)                                                         | Project created with scope inherited                      |
| H   | Run the project (licence-aware) | Department engineers, project manager                                                | Phases progressed; licences tracked; deliverables shipped |

---

## 2. End-to-end journey walked through Norman's seven stages

For each activity I name: **the gulf of execution** (can the actor do it?), **the gulf of evaluation** (do they see it worked?), and **the slips** the UI must defang.

### Activity A — Capture & grow a lead

**Goal:** Sales person registers a prospect and keeps a complete record of every interaction until that prospect is RFQ-ready.

**Conceptual model spine:**
`Lead — has-many → Communications — has-many → Attachments — referenced-by → RFQ Request`

**Gulf of execution (signifiers to get right):**

- The "Log communication" affordance lives **on the lead detail page**, top-right, primary CTA. Not hidden in a sub-tab.
- The communication entry sheet defaults the date/time to _now_ and the actor to _the current user_ — never make the sales person re-enter what the system already knows (Norman: _knowledge in the world_).
- "Add attachment" is a secondary CTA next to "Log communication" — same surface, different action; same visual rhythm.
- Channel type picker (Call / WhatsApp / Email / Meeting / Site visit / Other) is segmented control, not a dropdown — discoverability is a 1-tap reveal.
- Required minimum on a comm log entry: channel + brief note. Anything else (duration, outcome tag, follow-up date) is optional and progressive-disclosure.

**Gulf of evaluation:**

- The comms log is a **reverse-chronological timeline** on the lead detail page, with channel icon + actor avatar + time + first 80 chars + expand-to-read-full.
- A "last contact" pill at the top of the lead card (Sales Person sees "Last contact: 3 days ago" without clicking in) — closes the evaluation gap on a per-lead basis.
- Lead list view sortable/filterable by "days since last contact" — closes the evaluation gap on the _cross-lead_ level (Sales Person can see who has gone cold).

**Slips this screen invites & how to defang:**

- _Memory-lapse slip:_ sales person logs a call, forgets to set a follow-up reminder → **add a "Schedule follow-up" inline toggle inside the comm log sheet** with sensible default (3 working days). One screen, two outcomes; the follow-up is a side-effect of the log entry, not a separate task.
- _Description-similarity slip:_ two leads with same client name from different campaigns → **lead list rows must show the source channel and the registration date as secondary text**, not just the name.
- _Capture error:_ logging the comm against the wrong lead → contextual log (entry sheet opens from the lead detail page, lead identity locked at the top of the sheet, no lead-picker inside).

**P1 future:** WhatsApp Business API integration (per memory, future scope — manual entry covers MVP). Email auto-ingestion likewise deferred.

---

### Activity B — Request an RFQ (auto-qualifies the client)

**Goal:** Sales person flips the lead into a priced opportunity, declaring which departments are involved.

**Conceptual model spine:**
`Lead → (Request RFQ action) → RFQ { scope: Department[] } → assigned to dept manager(s)`
The RFQ request **promotes the lead's qualification state** in one step — no separate "qualify" action.

**Gulf of execution:**

- "Request RFQ" is the **single primary CTA** on the lead detail page (right side, sticky on scroll). Once clicked, the user enters a focused 1-step wizard, not the lead form again.
- The wizard asks: project title, brief scope description, **departments involved** (multi-select chips for Architecture / Structural / MEP / Safety / Surveying / Licensing / Supervision / etc., admin-configurable), expected start, optional attachments. Pre-fills client + sales person from context.
- Department selection is the **single most consequential field**. Use signifier weight (larger chips, helper text "Pick every department that will price a section of this RFQ"). Norman: _get the mapping right_ — what the user picks here becomes the swim-lane structure of the quote.
- "Submit" promotes the lead to **Qualified** in the same transaction; no second click anywhere.

**Gulf of evaluation:**

- Post-submit: navigate to the new RFQ detail page (not back to lead list). Show toast: "RFQ-2026-0142 created · assigned to Eng. Eng. Manager(s) for triage." The toast is the receipt for the action.
- The lead's status pill changes to **Qualified · RFQ-2026-0142** with a link.

**Slips:**

- _Mode error:_ sales person submits expecting it to draft, gets shocked it auto-qualifies → mitigate with helper text on the wizard ("Submitting this will qualify the lead and notify the department managers.") and an "Undo" snackbar for 8 seconds after submit, which reverts the qualification + voids the RFQ.
- _Memory-lapse slip:_ sales person picks only one department when two were actually needed → the multi-select is sticky on the page until they confirm. We could also offer the lead pricer a "Add another department" flag downstream that bounces back to the sales person.

---

### Activity C — Assign the RFQ

**Goal:** Department manager picks who builds the price offer for their department, and (in multi-dept cases) the single Lead Pricer who assembles the final quote.

**Conceptual model spine:**
`RFQ { departments: Dept[] } → for each dept: Assignment { assignee: User, isLeadPricer: bool } where exactly one Assignment.isLeadPricer = true across the whole RFQ`

**Gulf of execution:**

- The RFQ detail page (Department Manager's view) shows a **per-department row**, each row has its own "Assign" picker. UserPicker is filtered to active members of that department.
- One — and only one — assignee across the whole RFQ carries a "Lead Pricer ⭐" toggle. The UI enforces this constraint with a visible signifier (the star is filled and locked once chosen; if you re-toggle on another assignee, the previous one's star clears with an inline note "Lead Pricer moved to [name]").
- For single-department RFQs, the chosen pricer is implicitly the lead — no extra UI surface. Don't make people set what is mechanically inferable.
- "Assign all" CTA only enabled when every department row has an assignee AND exactly one lead pricer exists. Norman: _exploit the power of constraints_.

**Gulf of evaluation:**

- After assignment, the RFQ status pill moves to **Pricing**. Each per-department row shows assignee avatar + name + lead-pricer badge.
- Notification fan-out: Lead Pricer + each co-pricer + sales person all get inbox + push.

**Slips:**

- _Description-similarity slip:_ two engineers with the same first name → UserPicker shows role badge + department badge per option (already standard per memory `project_abak_mvp_design_submission`'s P0 work). Reuse that pattern here.
- _Capture error:_ manager accidentally assigns themselves → not actually a slip, this is a valid case (a manager can be the pricer); allow it without friction.

---

### Activity D / E — Price the work (single-dept → multi-dept)

**Goal:** Pricer(s) fill in scope items, prices, methodology, gantt blocks, and produce a draft quote.

**Conceptual model spine:**

```
Quote (one per RFQ)
├── Header { client, project, ref, date, validity, currency, intro narrative }
├── DepartmentSection (one per dept on the RFQ)
│   ├── LineItem[] { # | scope | qty | unit | unitPrice | totalPrice }
│   ├── MethodologyCard[] (one per LineItem, optional) { description, steps[], deliverable }
│   └── GanttBlock[] (one per LineItem, optional) { startDay, durationDays, categoryTone }
├── PaymentSchedule { milestone[] { % | label } where sum(%)=100 }
├── DocumentsRequiredFromClient[] (configurable per dept, editable per quote)
├── TermsAndConditions[] (T&C library, can include/exclude per quote)
└── Notes (free text, optional)
```

The methodology card and gantt block exist **per line item**, not per quote. That matches the canonical 8-page sample (see `Process/نماذج عروض اسعار/Quotation_Q26422-1300-4_EN.html`) where each scope row has a matching methodology card and gantt row. The system must be able to auto-generate all three in lockstep.

**Gulf of execution — single department:**

- One screen, three panes (in RTL: pricer's eye starts top-right):
  - **Pane 1 (top):** Header (auto-filled from RFQ + client + sales person). Pricer can edit "project title", "brief scope intro" narrative.
  - **Pane 2 (middle):** Line-item table. Each row = scope + qty + unit price; total auto-computes; subtotal/VAT/grand-total in the footer. Inline "+ Add line item" at the bottom.
  - **Pane 3 (right, sticky):** Quote-level pane — payment schedule (must = 100%), validity period, T&Cs picker, requirements picker.
- Each line item has an "expand" caret that opens a drawer where pricer can add methodology card (description, 3–5 step bullets, deliverable) and gantt position (start day, duration). Both default to empty; saving the line item without them is allowed (degraded PDF will skip those pages).
- The pricer can request **additional documents** from client or a **site visit** at any point via a side panel — both are tracked back to the sales person as inbox items.

**Gulf of execution — multi-department (Lead Pricer view):**

- Same screen, but the line-item table has **section headers per department**. The Lead Pricer can see+edit every section. Non-lead pricers see only their own section in their view (the lead's name and avatar visible at the top so they know who's stitching things together).
- A status strip at the top of the line-item table: "Architecture · Eng. Salim ✅ Submitted · Surveying · Eng. Reem 🔄 In progress · MEP · Eng. Khalid ⏳ Not started." Lead Pricer can chase by clicking the avatar.
- The Lead Pricer's "Submit for approval" CTA is disabled (with tooltip) until every department section is marked "Submitted" by its owner. Constraints over confirmation dialogs — Norman: _make irreversible actions difficult, not annoying_.

**Doc request / site-visit request — Norman lens:**

- These are **augmentations**, not detours. The pricer doesn't leave the price-builder; a side panel slides in. The request goes to the sales person's inbox.
- Doc request form: free-text "what's needed" + optional checklist if the dept admin has predefined a library (e.g., Safety dept often needs "soil report, electrical loads, civil defense form"). The library is admin-configurable.
- Site-visit request form: preferred date range + visit purpose. After submission, the engineer can directly contact the client to firm up logistics — every contact is appended to the lead/client's comms log automatically (engineer is the actor, sales person is the CC on the log entry). This honors the "sales person is single thread-of-record" rule without making sales a bottleneck for technical coordination.

**Gulf of evaluation:**

- A live preview pane (toggle, like a print preview) — pricer can flip to "PDF preview" at any time and see exactly what the client will see. WYSIWYG, no surprises. Memory note: this is the same pattern as the existing quote print route at `app/[locale]/quotes/[id]/print/page.tsx`.
- Status pill on quote: **Draft · Last edited 12 min ago** with the last actor's avatar.

**Slips:**

- _Memory-lapse slip:_ pricer forgets the payment schedule sums to 100% → live validator at the bottom of the payment schedule pane shows the running total in red ("90% — schedule must equal 100%") until balanced. Submit-for-approval disabled with tooltip. _Forcing function justified_ because payment schedule that ≠ 100% is structurally invalid.
- _Description-similarity slip:_ two line items "Building Permit Issuance" vs "Demolition Permit Issuance" — visually similar in compact rows → display the deliverable (from methodology card) as secondary text under the scope label when present.
- _Mode error:_ pricer thinks they're editing the lead methodology but is in fact in their own dept section (multi-dept case) → section header is sticky on scroll and color-toned to the department.

---

### Activity F — Quote negotiation & discount

**Goal:** Sales person sends the quote, the client negotiates, sales person grants discounts within their ceiling or requests approval to exceed it.

**Conceptual model spine:**

```
Quote
├── status ∈ {Draft, PendingApproval, Approved, Sent, Negotiating, Won, Lost, Postponed}
├── DiscountGrant[]   (granted by sales person within ceiling — auto-applied, audit-logged)
└── DiscountRequest[] { requestedBy, amountPct, justification, approvalChain[] }

DiscountApprovalConfig (admin-configurable, owned by CEO/Admin)
├── mode ∈ {tiered, sequential}
├── salesCeilingPct                       e.g. 5
├── tiers[] { upToPct, approver }         e.g. [{ <=10, manager }, { <=20, ceo }]      // tiered mode
└── sequence[] { approver, order }        e.g. [{ manager, 1 }, { ceo, 2 }]            // sequential mode
```

**Gulf of execution:**

- On the quote detail page (Sales Person view), a "Grant discount" sheet shows:
  - The current ceiling ("You can grant up to 5% without approval.")
  - A % slider clamped to the ceiling, with the recalculated total below.
  - If they exceed the ceiling, the UI rolls into a justification step (with admin config preview: "Above 5%, approval is required from Main Manager. Above 10%, also from CEO.").
- _The admin config UI_ (separate, in Admin Settings → Pricing Policy) lets the CEO/Admin pick the mode (radio: Tiered / Sequential) and edit thresholds. Live preview: "Sales rep grants ≤5% → no approval. 5–10% → Main Manager. >10% → Main Manager then CEO." The preview is the entire signifier of the policy.

**Gulf of evaluation:**

- The quote detail page shows a **discount audit strip** under the line items: each grant + each request with status + each approval. Reverse-chronological. The client never sees this; the team sees the whole history.

**Slips & forcing functions:**

- _Capture error:_ sales rep types 25 instead of 2.5 → number stepper / slider clamps at the ceiling. Free numeric input is a slip magnet.
- _Mode error:_ in a switch from tiered to sequential mode mid-deal, pending requests may sit in a stranded state → admin config UI surfaces a banner if any pending requests exist when the mode is changed, and requires the admin to choose "Apply only to new requests" or "Reroute existing requests under new mode".

**Norman flag on confirmation dialogs:** No "Are you sure?" on grant — the audit log + undo (within 30s) is sufficient. Confirmation reserved for _irreversible_ actions (e.g., marking quote Lost — see Activity below).

---

### Activity G — Won → 1-click project

**Goal:** Sales person marks the quote Won → department manager(s) get notified → 1-click creates the project with everything carried over.

**Conceptual model spine:**
`Quote(status: Won) → 1-click → Project { phases: from-line-items, departments: from-quote-sections, payment: from-quote-schedule, docs: from-quote-attachments, licences: empty }`

**Gulf of execution:**

- The Quote detail page has a "Mark Won" CTA. Behind it sits a side panel: signature attachment (upload PDF/image), award date, optional notes. On confirm, the quote moves to Won.
- Immediately afterwards, the system displays a "Convert to project" CTA in the same surface (not a modal) with an inline preview of what will be created: phases from each line-item, dependencies derived from the gantt blocks, departments inherited. Sales person doesn't see this CTA — the **department manager** does (the lead pricer's manager, or the dept-of-the-quote's manager). Norman: _get the mapping right_ — the action sits where the activity continues.
- The conversion is a single click. Result: navigate to the new Project page.
- Status pill on the source quote becomes **Won · Project P-2026-0091**.

**Gulf of evaluation:**

- Toast: "Project P-2026-0091 created from QUO-2026-0142."
- The new project page opens directly to the **Gantt tab** (carried over from the quote's per-line-item gantt blocks), so the dept manager sees the planned timeline immediately. Reuses the existing Gantt component (`packages/web/src/components/projects/gantt.tsx`).

**Slips:**

- _Memory-lapse slip:_ sales person marks Won without uploading the signature → conversion CTA is gated by "signature attached" being true (a hard block, justified because Article 11 of contract requires written acceptance).
- _Capture error:_ department manager clicks "Convert" then realizes scope changed in negotiation → the conversion is reversible within 24h via "Undo conversion" on the project detail page (Norman: _make actions reversible_).

**Article reminder:** This conversion is the moment ownership transfers (Contract Article 7 — IP transfers after full payment, so don't surface IP language here; that's a Finance concern).

---

### Activity H — Operate the project (licence-aware)

**Goal:** Engineers work through phases, with licences fetched from government portals tracked on the project, blocking dependent phases until issued.

**Conceptual model spine:**

```
Project
├── Phase[]       { id, name, dept, plannedStart, plannedEnd, status, dependsOnLicences: LicenceId[] }
└── Licence[]     { id, name, govPortal: { name, url }, requestId, appliedDate, status ∈ {Applied, UnderReview, Issued, Rejected}, issuedDate?, attachments[] }

Project.timeline math:
  if any active phase has dependsOnLicences and any of those licences != Issued → phase is BLOCKED.
  while ≥1 phase is BLOCKED waiting on a licence → project.timelineState = PAUSED.
  paused intervals are excluded from slip calculation and from the gantt's "today line" math.
```

**Gulf of execution:**

- Project detail page has a **Licences tab** with one row per licence: name, gov portal (clickable link), request ID, applied date, status, issued date, attachments. "Add licence" CTA top-right opens a side sheet with all required fields. Anyone with project access can open the row and click the portal URL — that's the affordance "I can check the status myself."
- On the Project's **Gantt tab**, phases that are licence-dependent display a small licence chip on the bar (e.g., "🪪 BLDG-PRM"). Hovering reveals the licence name + current status. If the licence is not yet Issued, the phase's bar is rendered in a paused tone (desaturated + dashed border) and a banner overlays the bar: "Waiting on Building Permit."
- Trying to mark such a phase "Start" or "In Progress" shows a hard-block toast: "This phase is waiting on Building Permit. Update the licence to Issued before starting." The button itself is disabled with tooltip pointing to the licence row. **Hard block, not a confirmation dialog** — the user's action would be invalid, so the affordance should match (Norman: _prevent the slip, don't punish it after_).
- Flipping a licence to Issued cascades immediately: any blocked-dependent phases become startable, and the project's `timelineState` returns to "Active". The paused interval is recorded for reporting (e.g., "Building Permit added 12 days to project duration"). The cascade is visible — a banner appears: "3 phases unblocked. Updated timeline saved." So the user sees the effect.

**Gulf of evaluation:**

- The Gantt shows paused phases with a distinct tone; the project header shows "Paused (waiting on 1 licence)" when the project is paused, with the licence linked.
- A simple report at the bottom of the Licences tab: "Total time waiting on licences: 18 days" — gives the team and CEO an evaluation surface for the _systemic cost_ of licence delays.

**Slips:**

- _Capture error:_ engineer types the wrong request ID → it's a free text field but a "Verify" button alongside opens the gov portal URL in a new tab so the engineer can paste-compare. The system never tries to "validate" the ID itself (no integration with gov portals in MVP).
- _Memory-lapse slip:_ a licence sits at "Applied" for weeks because nobody checked → schedule a per-licence reminder cadence (admin-configurable, default: every 5 working days while status ∈ {Applied, UnderReview}, ping the owner). This is an instance of _signifiers replacing memory_.

**Norman flag — phase dependency hard block:**
The user has chosen hard-block over soft-warning. This is the right call when the activity is **regulated** (you literally cannot legally start the work without the licence). It is also a forcing function — which Norman approves of for _genuinely irreversible_ operations (here, civil/criminal liability if work starts without a licence). Document the override path: the CEO can mark a phase "Start without licence (formal exemption)" with a mandatory written justification, which is logged on the audit trail. Don't expose this to engineers or department managers.

---

## 3. Conceptual model spine (entities & relationships)

```
Lead
├── Communications[]            ← reverse-chrono timeline
├── Attachments[]
└── RFQ?                        ← created via "Request RFQ" action

Client                          ← promoted from Lead, single per real-world client
├── ProjectS[]
├── QuoteS[]                    ← historical, including Lost/Postponed
└── Communications[]            ← inherits from Lead's, continues after qualification

RFQ
├── departments: Dept[]
├── Assignments[]               ← per dept, with isLeadPricer bool
├── DocRequests[]               ← engineer → sales person, with status
├── SiteVisitRequests[]         ← engineer → sales person, with status
└── Quote                       ← always exactly one Quote per RFQ

Quote
├── DepartmentSection[]
│   ├── LineItem[]
│   │   ├── MethodologyCard?
│   │   └── GanttBlock?
│   └── ownerAssignee: User
├── PaymentSchedule (milestones, must sum 100%)
├── DocumentsRequiredFromClient[]
├── TermsAndConditions[]        ← references central T&C library + per-quote overrides
└── status ∈ {Draft, PendingApproval, Approved, Sent, Negotiating, Won, Lost, Postponed}

Project (created from Quote on Won)
├── Phases[]                    ← derived from line-items (1:1 by default, manager can split/merge)
│   └── dependsOnLicences: LicenceId[]
├── Licences[]                  ← created by engineers as needed
├── Departments[]               ← inherited
├── PaymentSchedule             ← inherited; ties to Finance
└── timelineState ∈ {Active, Paused (cause: Licence|Client|...)}

PricingPolicy (singleton)       ← admin-configurable, owned by CEO/Admin
├── salesCeilingPct
├── mode ∈ {tiered, sequential}
├── tiers[] or sequence[]
└── auditTrail[]

CommunicationsLog (cross-cutting)
└── entries[] visible on Lead, Client, RFQ, Project, and per-user "My recent contacts"
```

A few invariants worth signposting in the code:

- One Quote per RFQ. Versioning happens **inside the Quote** (revision history), not as separate Quote records. Memory note `project_abak_mvp_design_submission` already implies this; reaffirm it.
- One LeadPricer per RFQ (across all department sections).
- PaymentSchedule.sum(%) == 100 enforced at the quote-builder layer (not just on submit — live).
- Project ↔ Quote is 1:1. If scope changes post-conversion, the project's scope is the source of truth; the quote is frozen historical.

---

## 4. The Quote Builder structure (auto-generated PDF)

The canonical sample is `Process/نماذج عروض اسعار/Quotation_Q26422-1300-4_EN.html`. The 8-page anatomy maps cleanly onto the data model above; the auto-generator iterates the model once and produces the document.

### 8-page anatomy ↔ data fields

| Page | Section                                                                                                | Data source                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 1    | Cover (project name + client + ref + date)                                                             | Quote header                                                                                                |
| 2    | Company profile (boilerplate)                                                                          | Per-org settings (logos, blurb, accreditations, contact, services list) — admin-editable, but mostly static |
| 3    | Quotation table (line items + subtotal + VAT + total + amount-in-words)                                | Quote.DepartmentSection[].LineItem[] + VAT (admin-configurable %, default 15)                               |
| 4    | Payment system (total banner + disbursement schedule cards + project timeline cards + banking details) | Quote.PaymentSchedule + Quote.headerMeta (validity, currency, start condition) + org banking (admin-static) |
| 5    | Work methodology (per-line cards: description, steps, deliverable)                                     | Quote.DepartmentSection[].LineItem[].MethodologyCard[]                                                      |
| 6    | Project timeline (Gantt)                                                                               | Quote.DepartmentSection[].LineItem[].GanttBlock[]                                                           |
| 7    | Requirements & T&Cs (docs from client + general T&Cs)                                                  | Quote.DocumentsRequiredFromClient[] + Quote.TermsAndConditions[]                                            |
| 8    | Thank-you closing (boilerplate)                                                                        | Per-org settings                                                                                            |

### Multi-department assembly (the Lead Pricer pattern)

- The line-item table on page 3 displays **section headers per department** when the quote has >1 department. Within each section, items numbered with a department prefix (e.g., A.1, A.2 for Architecture; S.1, S.2 for Surveying). Numbering scheme is admin-configurable; default: dept code + dot + number.
- The methodology cards on page 5 are likewise grouped per department, with a section title.
- The gantt on page 6 shows all phases in one chart (cross-department) but bars are color-toned per department (legend).
- T&Cs on page 7 are unified (the quote is one offer, not multiple).

### Methodology & Gantt — graceful degradation

The canonical sample has rich methodology + Gantt. **Not every quote will have these** (e.g., the per-visit supervision offers in `عروض الاشراف-نظام السعر لكل زيارة/` are simpler). The PDF generator must skip the methodology page and the gantt page when those fields are empty, instead of producing blank pages. The data model already supports `MethodologyCard?` and `GanttBlock?` as optional.

### T&Cs library

- Admin maintains a central **T&Cs library** (configurable per department, in Arabic and English). Examples from the canonical sample: "This offer is non-divisible," "The offer does not include any item not listed above," "The offer does not include any governmental fees."
- Per-quote, the lead pricer can include T&Cs from the library by checkbox, edit them in-place (the override is per-quote, doesn't change the library), or write a new ad-hoc clause.
- "Documents required from client" follows the same pattern — admin library per department, picker per-quote, ad-hoc clauses allowed.

### Reference numbers

The canonical sample uses `Q26422 / 1300-4`. The system's `QUO-YYYY-XXXX` format works for internal IDs; for the client-facing PDF, allow the admin to configure a custom reference scheme (e.g., year + sequence + department code + revision number). Don't hardcode the client-facing format — different industries have different conventions.

---

## 5. The Project / Licence model — explicit decisions

### Phase ↔ Licence dependency

- A licence is a project-scoped resource (not a phase-scoped one) — multiple phases can depend on the same licence. Each phase declares its dependencies as a list of licence IDs.
- Licence statuses: `Applied`, `UnderReview`, `Issued`, `Rejected`. Only `Issued` unblocks dependent phases. `Rejected` requires a remediation action (re-apply as a new licence record, linked to the rejected one for audit).
- Licence ↔ Phase wiring is editable by the dept manager (engineers can create licences but only managers wire dependencies — guards against a slip where an engineer adds a licence but forgets to wire phases or wires the wrong ones).

### Timeline pause math

- `Phase.status = Blocked` while any of its `dependsOnLicences` is not `Issued`.
- `Project.timelineState = Paused` while any of its currently-active or due-to-start phases is `Blocked`.
- Paused intervals do **not** count as slip. The "planned end" of phases downstream of a paused phase shifts forward by the pause duration. The Gantt redraws the planned bar to reflect this — the "what was promised" anchor stays visible (memory note: existing Gantt at `packages/web/src/components/projects/gantt.tsx` already supports this pattern with planned outline + filled progress).
- Reports surface a "total paused days per project" metric — the systemic visibility Norman calls for.

### Override

CEO-only "Start phase without licence" exemption (formal mode, mandatory justification, audit-logged). Hidden from engineer + manager surfaces by default. Norman: _forcing functions are appropriate for genuinely irreversible operations_ — civil/criminal liability for unpermitted work is the test that justifies the lock.

---

## 6. Discount approval — admin configuration UI

The admin (CEO or portal admin) configures the policy at `Admin Settings → Pricing Policy`. The screen has:

1. **Sales ceiling** — single % input ("Sales rep can grant up to \_\_\_% without approval.")
2. **Mode** — radio: Tiered / Sequential.
3. **Tiered configuration** (visible when mode = Tiered): a list of `{ "up to %", "approver" }` rows. Approver picker filters to managerial roles. "Add tier" appends a row.
4. **Sequential configuration** (visible when mode = Sequential): an ordered list of approvers. Drag-to-reorder.
5. **Live preview** — a panel rendering: "Sales rep grants ≤5% → no approval. 5–10% → Main Manager. >10% → Main Manager then CEO." Updates in real time as the admin edits. This is the **conceptual model surface** — the admin should be able to read off the policy in plain language.
6. **Save** — saves to the singleton `PricingPolicy` record. If pending discount requests exist, the system asks "Apply new policy to existing pending requests, or keep them on the old policy?"

Norman: _get the mapping right_ — by making the abstract policy concrete (the live preview), the admin can predict what will happen without running a test.

---

## 7. Communications log — the contact-pattern primitive

A `Communication` entry is the cross-cutting primitive that ties Sales, Engineering, and (later) Marketing comms to a single timeline per client/lead/project.

```
Communication {
  id, actor, ccActors[],          // who made the contact, who is informationally CC'd
  channel ∈ {Call, WhatsApp, Email, Meeting, SiteVisit, Other},
  direction ∈ {Inbound, Outbound, BothWays},  // optional
  subject,
  body (markdown),
  attachments[],
  occurredAt,
  scope: { leadId? clientId? rfqId? projectId? }    // at least one
  followUpDate?       // optional inline reminder
}
```

**The CC pattern (Activity D's site-visit case):** when an engineer logs a comm during site-visit coordination, the sales person responsible for that client appears as a ccActor automatically. The comm shows up on the engineer's "my recent contacts" view and on the lead/client's timeline. The sales person sees it in their inbox feed without needing to track engineers manually.

**Future channel integrations** (NOT in MVP but data model supports):

- WhatsApp Business API → auto-creates Communication entries with channel=WhatsApp.
- Email forwarding inbox → auto-creates Communication entries with channel=Email.
- Phone call logging integration → auto-creates entries with channel=Call.

The data model is built to receive these later without restructuring.

---

## 8. Roles after correction (single source of truth)

| Role                                        | What they primarily do                                                                                                                                                               | Where they live                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Sales Person**                            | Capture leads · log comms · request RFQs · negotiate quotes · grant discounts within ceiling · request discount approval · mark Won/Lost/Postponed                                   | `personas/sales-rep.md` (already exists)                                                   |
| **Sales Manager (Main Manager)**            | Oversee sales pipeline · approve mid-tier discounts · approve large quotes per threshold · own the team targets                                                                      | `personas/sales-manager.md` (already exists)                                               |
| **Department Manager**                      | Triage incoming RFQs for their department · assign pricers · designate the Lead Pricer · approve quote sections · wire licence dependencies on projects · 1-click convert Won quotes | NEW persona doc needed (likely `personas/department-manager.md`)                           |
| **Department Engineer (Pricer / Executor)** | Price assigned RFQ sections · request docs/site visits · build methodology + gantt · execute project phases · apply for & track licences                                             | RENAME `personas/rfq-engineer.md` → `personas/department-engineer.md` and rewrite          |
| **CEO**                                     | Approve top-tier discounts and large quotes · ratify policy config · CEO-exempt phase unblocks (rare)                                                                                | `personas/ceo.md` (already exists; episodic-user posture stays)                            |
| **Finance Officer / Reviewer**              | Validate payment receipts · track milestone billing                                                                                                                                  | `personas/finance-officer.md`, `financial-reviewer.md` (already exist)                     |
| **Project Manager**                         | Run delivery on Active projects · track phases against Gantt · coordinate dept engineers                                                                                             | `personas/project-manager.md` (already exists, but rewrite to assume licence-aware phases) |
| **Admin**                                   | Configure SLAs, channel list, T&Cs library, doc-requirement libraries, discount policy, payment templates, currency/VAT, user roles                                                  | Folded into Sales Manager per existing decision; the policy screens live in Admin Settings |

**To delete:** `personas/rfq-engineer.md` (rename + rewrite), `personas/pro-government-delegate.md` (delete outright). Government work is folded into Department Engineer + Licence model.

---

## 9. File / code touch list (the work to do)

### Docs (high priority)

- **DELETE** `ABAK_ERP/docs/personas/pro-government-delegate.md` — role doesn't exist.
- **DELETE + REPLACE** `ABAK_ERP/docs/personas/rfq-engineer.md` → `personas/department-engineer.md` with corrected scope (any dept member, picks up RFQ assignments, executes project phases, applies for licences).
- **NEW** `ABAK_ERP/docs/personas/department-manager.md` — the triage + assignment + 1-click-convert role.
- **DELETE** `ABAK_ERP/docs/flows/b2-government-tender.md` — separate tender flow no longer exists.
- **REWRITE** `ABAK_ERP/docs/flows/b3-gov-transaction-lifecycle.md` → `flows/b3-licence-lifecycle.md`, scoped to project-attached licences.
- **REWRITE** `ABAK_ERP/docs/flows/a3-rfq-assignment.md` to use Lead Pricer model + multi-dept assignment.
- **REWRITE** `ABAK_ERP/docs/flows/a4-quote-approval.md` to include configurable discount approval.
- **REWRITE** `ABAK_ERP/docs/flows/a5-quote-dispatch-outcome.md` to include 1-click conversion to Project.
- **UPDATE** `ABAK_ERP/docs/flows/a1-lead-capture.md` to add the comms log primitive.
- **UPDATE** `ABAK_ERP/docs/personas/sales-rep.md` to mark them as the single thread-of-record + comms-log owner.
- **UPDATE** `ABAK_ERP/docs/flows/README.md` to reflect the new flow list.

### Module specs (lower priority — these are project planning docs)

- **REVISE** `Process/ABAK_ERP_Module1_LeadCapture_v1.md` — drop government channel; drop SLA-for-tender; add communications log primitive on Lead.
- **REVISE** `Process/ABAK_ERP_Module4_Quotation_v1.md` — drop "Government tender template flow"; rewrite assignment section (Lead Pricer); rewrite approval section (configurable); add 1-click Project conversion.
- **REVISE** `Process/ABAK_ERP_Module3_SalesPipeline_v1.md` — drop "RFQ Engineer" references; sales person is single thread-of-record.
- **NEW** `Process/ABAK_ERP_Module6_Projects_v1.md` — define Project + Phase + Licence model (per Section 5 above). This is the new module emerging from the correction.

### Next.js prototype (code work)

- **`packages/web/src/components/leads/communications-log/`** — new component: timeline + "Log communication" sheet with channel chips + inline follow-up.
- **`app/[locale]/(dashboard)/leads/[id]/page.tsx`** — surface "last contact" pill, embed the comms log component, surface "Request RFQ" CTA.
- **`app/[locale]/(dashboard)/rfqs/new/page.tsx`** — RFQ creation wizard with department multi-select + qualifying side-effect.
- **`app/[locale]/(dashboard)/rfqs/[id]/page.tsx`** — assignment UI with per-department UserPicker + Lead Pricer toggle (mutually exclusive across dept rows).
- **`app/[locale]/(dashboard)/quotes/[id]/page.tsx`** — multi-section line-item table + per-line methodology+gantt drawer + side-pane T&Cs/docs/payment-schedule + live preview.
- **`packages/web/src/components/quotes/department-section.tsx`** — new component for the per-department section header + line-item subgroup.
- **`packages/web/src/components/quotes/methodology-card-editor.tsx`** — per-line drawer.
- **`packages/web/src/components/quotes/gantt-block-editor.tsx`** — per-line drawer (start day + duration + category tone).
- **`packages/web/src/components/quotes/payment-schedule-editor.tsx`** — milestone list with live sum=100% validator.
- **`app/[locale]/(dashboard)/quotes/[id]/discount/`** — discount grant + request UX.
- **`app/[locale]/admin/pricing-policy/page.tsx`** — admin config UI for `PricingPolicy` singleton.
- **`app/[locale]/(dashboard)/projects/[id]/licences/`** — Licences tab.
- **`packages/web/src/components/projects/licence-row.tsx`** — single licence row with portal URL + status + ID.
- **`packages/web/src/components/projects/gantt.tsx`** — extend to render licence-dependent phase chips + paused bar tone.

### Database / API (schema work)

- New tables: `communications`, `pricing_policy`, `licences`, `phase_licence_dependencies`, `discount_grants`, `discount_requests`.
- Modify: `quotes` → add `department_sections` relation; `line_items` → add `methodology_card` + `gantt_block` relations; `phases` → add `dependsOnLicences` relation + `pausedIntervals[]` for the time-paused-due-to-licence math.
- Drop: any "tender template" tables, `government_tender_lead_channel` enum value.

### Memory updates

- ✅ Already updated: `feedback_abak_process_corrections.md`, `MEMORY.md`.
- TODO: update `project_abak_mvp_design_submission.md` to point at this doc as the authoritative journey + add a note that 2 personas + 11 flow docs are now superseded pending rewrite.

---

## 10. Open questions still worth resolving

These came up during the redesign but didn't block the doc. Worth tabling at the next sync:

1. **VAT exempt scenarios** — some of the existing offers may have been pre-2024 (VAT 15% is configurable; are there cases of 0% e.g. exports?).
2. **Quote revision visibility to client** — do we ever send v2 of a quote to the client with track-changes visible, or always replace silently? Affects the comms-log entry that records the resend.
3. **Site-visit slot booking** — do we plan a shared calendar for engineers, or rely on the comms log + free-text?
4. **Licence renewal** — some licences expire (e.g., commercial registration). Do we treat renewal as a new Licence record linked to the old, or as a status-flip on the same record?
5. **Multi-currency** — the canonical sample is SAR-only. Do international clients show up? Affects the Quote.headerMeta.currency field.
6. **Project-without-quote** — sometimes ABAK is asked to do work without going through the formal quote process (small follow-ons). Allow Project creation directly, or always require a quote (even a $0 one)?
7. **Lead source channel for direct-sales** — the spec dropped "Government Tender" as a top-level channel; what does the current channel list collapse to (Walk-in, Referral, Existing-client repeat, Social, Website, Phone, Other)?

---

_End of v1. Awaiting client review before any code/file changes are made downstream._
