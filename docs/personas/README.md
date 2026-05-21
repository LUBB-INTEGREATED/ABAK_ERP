# Personas — ABAK ERP

Pinned 2026-05-19. Revised 2026-05-21 after process correction (see [`CORRECTED_CLIENT_JOURNEY.md`](../CORRECTED_CLIENT_JOURNEY.md)). Companion to [`MVP_SCOPE.md`](../../MVP_SCOPE.md) and [`DESIGN_SYSTEM_MASTER.md`](../../DESIGN_SYSTEM_MASTER.md).

## What this is

One-pager for each of the 7 personas that the ABAK ERP serves. **Not** marketing personas — we keep no demographics, no day-in-the-life narrative, no feature wishlist. Five fields each, kept tight on purpose:

1. **Role** — job title in the ABAK org
2. **Responsibilities in the system** — which activities they own (cross-references the lead-to-cash spine)
3. **Device + context** — where and how they work
4. **Success measure** — the KPI they care about; "a good day" looks like…
5. **Friction risks** — Norman error-design lens: which slips this persona is most prone to, given their device/context/expertise

## What this is _not_

> _"There has been far too much emphasis on individual people, trying to model them, trying to build fascinating scenarios and 'personas.' I think much of this work misplaced, irrelevant, and potentially harmful."_ — Don Norman, 2005

Personas inform **swimlane responsibility** on activity flows and **friction calibration** per surface (mobile-in-field vs desktop-deep-work). They do **not** justify bespoke per-persona product surfaces. If a discussion drifts into "let's build the CEO dashboard," push back — the activity (approval) is what gets designed; the CEO is one of two users on that surface.

## The 7 personas

### Sales side

- [Sales Rep](sales-rep.md) — field-mobile, owns lead capture, the communications log (single thread-of-record for the client), pipeline moves, RFQ requests, negotiation, in-ceiling discounts
- [Sales Manager](sales-manager.md) — desktop, owns oversight, mid-tier approvals per the configurable Pricing Policy, target setting; also wears the System Admin hat

### Pricing & approval

- [Department Manager](department-manager.md) — desktop + mobile, triages incoming RFQs for their department, assigns pricers, designates the Lead Pricer (in multi-dept RFQs), 1-click converts Won quotes to projects, wires licence dependencies
- [Department Engineer](department-engineer.md) — desktop, the pricer + executor inside a department; builds quote sections, then runs project phases and tracks government licences
- [CEO](ceo.md) — mobile-light, episodic top-tier approver, owns Pricing Policy config, holds the licence-exemption override

### Delivery

- [Project Manager](project-manager.md) — desktop + tablet, owns project execution post-conversion; runs the licence-aware Gantt
- [Finance Officer](finance-officer.md) — desktop, owns payment validation, invoicing, closure gates 4–5

### Personas removed in the 2026-05-21 correction

- ~~RFQ Engineer~~ — folded into Department Engineer; the pricer can be any member of the department, picked per-RFQ by the Department Manager
- ~~Financial Reviewer~~ — folded into Department Engineer; the pricer sets both scope and pricing in the same activity
- ~~PRO (Government delegate)~~ — removed; government work is licensing inside normal projects, owned by the Department Engineer assigned to the relevant phase, tracked under the project's Licences tab

## How to use these in design discussions

- When designing a screen, name the **activity** first, then list **which personas land on this surface**. If the answer is "all 8," the surface is too generic. If the answer is "one persona only," check that you're not building a bespoke dashboard.
- When debating a feature, name the **friction risk** it defangs. "This helps Sales Rep avoid the description-similarity slip on duplicate clients" beats "this would be nice to have."
- When prioritizing, weight by **frequency of use × cost of slip**. Sales Rep × memory-lapse slip on lead capture is high-frequency, high-cost. CEO × capture error on approval is low-frequency, high-cost. Both warrant design attention but for different reasons.
