# A3 — RFQ Assignment + Preparation

**Status:** Rewritten 2026-05-21 per the corrected client journey. Companion to [A1 — Lead capture](a1-lead-capture.md) and [the journey master doc](../CORRECTED_CLIENT_JOURNEY.md).

## Activity goal

Take a freshly-submitted RFQ (the sales person picked the involved departments at submission) and turn it into a priced quote ready for approval. Success = no RFQ sits unassigned more than 4 business hours; no quote reaches approval with a missing department section; the Lead Pricer is unambiguous from the moment the multi-department case begins.

## What changed in the correction

The old model had a Sales-Manager-as-traffic-cop assigning a separate RFQ Engineer (technical) and Financial Reviewer (pricing). That model is gone. The correct model:

- The RFQ already carries the **departments involved** (chosen by the sales person at submission).
- Each involved department's manager is notified directly. **No Sales Manager triage step.**
- Each department manager assigns one of their own people (an engineer or themselves) as the pricer for their section.
- For multi-department RFQs, the managers collectively designate one of the assignees as the **Lead Pricer** ⭐ — the single human who sees all sections and submits the consolidated quote. Exactly one Lead Pricer per RFQ.
- The pricer does both **scope and pricing** in the same activity. No separate Financial Reviewer.
- The pricer can request **additional documents** (routed to the sales person) or a **site visit** (the engineer may then coordinate logistics directly with the client, CC'ing the comms log) before finishing the section.

## Personas (swimlanes)

| Persona                                                                   | Role on this activity                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sales Person**                                                          | Originator (already submitted the RFQ in A2). Recipient of doc requests + site-visit logistics CCs.                                                                                                                                             |
| **Department Manager(s)**                                                 | Triage incoming RFQ for their dept · assign pricer · designate Lead Pricer (in multi-dept).                                                                                                                                                     |
| **Department Engineer(s)** (one per dept; one of them is the Lead Pricer) | Build the section: scope, line items, methodology, gantt, payment-affecting decisions. The Lead Pricer also assembles the quote-level fields (payment schedule, T&Cs, documents required from client) and submits the whole quote for approval. |

## Seven-stage walkthrough

### Stage 1 — Goal

_"This RFQ needs a quote, and the work spans my department (and possibly others)."_

### Stage 2 — Plan

**Single-department RFQ:** the manager picks an engineer (or themselves) by capacity + expertise. The chosen pricer is implicitly the Lead Pricer — no extra UI surface.

**Multi-department RFQ:** the managers of each involved department each pick a pricer. They also collectively designate one of those pricers as the Lead Pricer. There's coordination friction here — who decides? Per the corrected journey, the _first manager to touch the RFQ_ is implicitly the lead manager, and they can propose a Lead Pricer (typically the pricer from the department that owns the largest section). The other managers can re-toggle the Lead Pricer flag in the UI; only one star can be lit at a time.

### Stage 3 — Specify

Manager opens the RFQ detail page. Per-department row, each with a UserPicker filtered to active members of that department. A `Lead Pricer ⭐` toggle on each row is mutually exclusive — toggling one clears the others.

**Gulf-of-Execution pinch point:** the Lead Pricer designation is the most consequential decision on this screen. Signifier weight: the star is visually heavier than the assignee chip; helper copy explains _"The Lead Pricer sees all sections and submits the whole quote."_

### Stage 4 — Perform

Manager hits "Assign all." The CTA is **constraint-gated**: disabled until every department row has an assignee AND exactly one Lead Pricer is set across the RFQ. Tooltip explains what's missing.

The system sends notifications to:

- Each assignee (push + inbox: "You've been assigned to price the [dept] section of RFQ-2026-0142")
- The Lead Pricer (push + inbox, with the ⭐ context: "You're the Lead Pricer on this RFQ — you'll assemble the whole quote once each section is submitted")
- The sales person (inbox only: "RFQ-2026-0142 is in pricing")

### Stage 5 — Perceive

Each pricer sees the new RFQ in their queue + a notification. Opening it lands them on the quote builder for their assigned section.

**Lead Pricer's view:** sees every section, with an in-progress status strip at the top ("Architecture · Eng. Salim ✅ Submitted · Surveying · Eng. Reem 🔄 In progress · MEP · Eng. Khalid ⏳ Not started"). They can also edit any section if needed.

**Non-lead pricers' view:** see only their own department's section, plus a small banner at the top noting who the Lead Pricer is ("Eng. Salim is assembling this quote — your section will be submitted to them when ready").

### Stage 6 — Interpret

Each pricer:

- Drafts their section's line items (scope + qty + unit price + total).
- Optionally attaches a methodology card and gantt block per line item (the canonical 8-page PDF requires these for the methodology page and the project timeline page; degraded gracefully when omitted).
- May open a side panel to **request additional documents** (routed to the sales person's inbox) or a **site visit** (also routed via sales for first contact, after which the engineer may coordinate logistics directly with the client — every contact is appended to the comms log).

The Lead Pricer additionally:

- Fills the **quote-level fields**: payment schedule (must sum to 100% — live-validated), Documents-required-from-client list (from library or ad-hoc), T&Cs (from library or ad-hoc), notes.
- Opens the **PDF preview** at any time to see exactly what the client will see (WYSIWYG; reuses the existing print route at `app/[locale]/quotes/[id]/print/page.tsx`).

### Stage 7 — Compare

**Section-level (every pricer):** their section is marked Submitted; status reflected in the strip on the Lead Pricer's view.

**Quote-level (Lead Pricer):** "Submit for approval" CTA gates on (a) every section submitted, (b) payment schedule = 100%, (c) at least one line item per submitted section. Tooltip enumerates anything missing. Once submitted, status moves to _Pending Approval_ and the configurable approval chain kicks in (see [A4 — Quote approval](a4-quote-approval.md)).

## Slip catalogue (Norman taxonomy)

| Slip                                         | Where it lives                                                                                                  | Mitigation                                                                                                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Capture error on Lead Pricer designation** | Manager assigns four pricers, forgets to flag the lead.                                                         | "Assign all" is constraint-gated until exactly one lead is set. Visible tooltip explains the gap.                                                                            |
| **Description-similarity slip on engineers** | Two engineers with similar names.                                                                               | UserPicker shows name + role + department badge + last-active.                                                                                                               |
| **Capture error across RFQs**                | Pricer working on two open RFQs types content into the wrong tab.                                               | Each RFQ has its own page with sticky header showing RFQ # + client + department; auto-save flushes per-section.                                                             |
| **Mode error: am I pricing or executing?**   | Same engineer also has active project work; switching tabs blurs the activity.                                  | Strong activity signifier in the page chrome (top banner: "Pricing — QUO-2026-0142 / Architecture section"); destructive actions show the activity in the confirmation copy. |
| **Knowledge-based mistake on missing T&Cs**  | The Lead Pricer assembles the quote but doesn't include T&Cs that are convention in a participating department. | T&C library carries per-department defaults; the quote builder auto-suggests them on quote creation; quote review surface highlights "default T&Cs not included" inline.     |
| **Memory-lapse on payment schedule = 100%**  | Lead Pricer's schedule sums to 99.9% due to rounding.                                                           | Live running total at the bottom of the schedule editor, red until 100%; Submit-for-approval disabled with tooltip pointing to it.                                           |

## Screen inventory

**Existing surfaces this activity touches:**

| Screen            | Path                                                      | Status                                                                          |
| ----------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| RFQ list + detail | `app/[locale]/(dashboard)/rfqs/page.tsx`, `[id]/page.tsx` | ✅ built; UserPicker shipped 2026-05-18                                         |
| Quote builder     | `app/[locale]/(dashboard)/quotes/[id]/page.tsx`           | ✅ built (single-section model); needs multi-department + Lead Pricer extension |
| Quote PDF preview | `app/[locale]/quotes/[id]/print/page.tsx`                 | ✅ built (shipped 2026-05-18)                                                   |

**Gaps surfaced by the corrected model:**

1. **Per-department sections on the quote builder** — current builder assumes one flat line-item list. Needs a `DepartmentSection` grouping with section headers + per-section submit + Lead-Pricer-only aggregate view. Build in `components/quotes/department-section.tsx`.
2. **Lead Pricer ⭐ toggle** on the RFQ assignment row — must enforce one-per-RFQ across all department rows. Build in `components/rfqs/lead-pricer-toggle.tsx`.
3. **Per-line-item methodology + gantt drawers** — `components/quotes/methodology-card-editor.tsx`, `components/quotes/gantt-block-editor.tsx`. Required to support the canonical 8-page PDF; degraded gracefully if empty.
4. **Doc-request and site-visit side panels** in the quote builder — `components/quotes/doc-request-panel.tsx`, `components/quotes/site-visit-request-panel.tsx`. Both route requests to the sales person's inbox; the site-visit panel records the request and surfaces the engineer's later direct-contact logs on the client's comms timeline.
5. **Payment-schedule live validator** — `components/quotes/payment-schedule-editor.tsx`. Running total at the bottom, disabled submit until 100%.

## Open questions

1. **Lead Pricer designation conflict** — what if two managers each want the Lead Pricer in their own department? The corrected journey assumes implicit "first manager to triage" gets the proposal right; reality may need a Sales-Manager arbitration step. Confirm.
2. **Section-level editing by Lead Pricer** — can the Lead Pricer overwrite a co-pricer's submitted section, or only ask them to revise? Currently assumed: Lead Pricer can edit any section (single responsibility for the final quote).
3. **Single-department single-pricer fast path** — for the common case (one department, one pricer), should we skip the Lead Pricer toggle entirely (implicit) or always show it (consistent UI)? Currently assumed: skip when single-dept; surface only in multi-dept.
