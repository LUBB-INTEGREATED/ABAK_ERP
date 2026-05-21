# CEO

## Role

Chief Executive Officer. Episodic user — typically a handful of approval moments per week, not a daily product user.

## Responsibilities in the system

- **Top-tier quote and discount approval** per the configurable Pricing Policy (the CEO is the final approver in either tiered or sequential modes when the threshold is exceeded)
- Owns the Pricing Policy itself in Admin Settings — picks tiered vs sequential, sets the sales ceiling, configures approver chains
- Spot-checks high-value RFQs in flight (read-only)
- **Licence-exemption override** — the only role that can mark a licence-dependent project phase "Start without licence (formal exemption)" with a mandatory written justification, when business need demands it (audit-logged; expected to be rare)
- Reviews executive summary reports (occasionally, when prepared by Sales Manager)

## Device + context

**Mobile primary** (iPhone). Approvals happen wherever they happen — between meetings, in transit, evenings. Sessions are 30 seconds to 2 minutes; the goal is usually a single decision, not exploration. Rarely opens the full app for browsing.

## Success measure

- Approval turnaround time (don't be the bottleneck — quotes above threshold sitting in the L2 queue are blocked)
- Margin and risk awareness on approved quotes — discovering a bad approval later means the surface failed
- Confidence in the team's recommendations (a healthy system has the CEO usually approving; a high reject rate signals the L1 surface isn't catching enough)

## Friction risks

- **Approving with insufficient context** — a one-line summary on mobile may hide commercial risk (margin compression, payment-term concessions, unusual exclusions). Mitigation: the approval card shows margin, deviation-from-rate-card, payment terms, and a "What changed since last version" diff inline. The Approve button is below — has to scroll past the context to reach it.
- **Capture error in quick succession** — approving several quotes/discounts in a row on phone, the last one slips through unnoticed. Mitigation: approval requires a tap-and-hold or a tap-then-confirm (light forcing function — justified because the CEO tier is the last gate before action).
- **Asymmetric action design** — when "Approve" is the only easy action and "Reject" requires reasons and re-routing, the system implicitly pressures approval. Mitigation: Reject is a peer button, not a secondary; reason templates speed it up; "Request changes" exists as a soft middle path that's also a single tap.
- **Description-similarity slip** — two quotes from the same client within days look identical on a small screen. Mitigation: card shows version (v2, v3) and a per-quote summary line ("revision after client requested longer payment terms") above the totals.

## Design note (Norman)

The CEO is **episodic** and should not get a bespoke dashboard. The approval-queue surface is shared with the Sales Manager. The same quote detail page the pricer built is what the CEO sees — with role-conditional callouts (margin, risk, requested discount, diff). Resist any "let's design the CEO dashboard" framing — design the **approval activity** and the CEO is one of the personas on it. The licence-exemption override is a separate, deliberately-friction-heavy action surfaced only on the affected project, not as a recurring queue item.
