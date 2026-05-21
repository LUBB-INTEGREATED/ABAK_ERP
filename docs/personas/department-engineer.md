# Department Engineer

## Role

Engineer inside one of ABAK's delivery departments (Architecture, Structural, MEP, Safety, Surveying, Licensing, Supervision, etc.). Plays two roles in the system depending on phase: **Pricer** when assigned to a draft quote, **Executor** when running phases on an active project. The same person, the same skill set — just two activities.

## Responsibilities in the system

- **As a pricer:** receives an RFQ section assigned by their department manager; drafts scope of work, selects services, sets unit prices/quantities/units; attaches a methodology card and gantt block per line item where applicable; submits the section for the Lead Pricer (or directly to approval, if single-dept)
- **As a pricer:** requests **additional documents** from the responsible sales person if needed; requests a **site visit** when mandatory before pricing; coordinates site-visit logistics directly with the client (sales person CC'd on the comms log)
- **As executor:** owns one or more phases on the active project; updates phase progress; attaches evidence on completion
- **As executor:** applies for and tracks **government licences** for the project on the relevant portal (Balady, Salama Gateway, Etimad, etc.); records the request ID + portal URL + applied date in the project's Licences tab; flips the status to `Issued` when received
- Responds to revision requests after approval if scope or pricing changes

## Device + context

**Desktop primary.** Long sessions with reference material open alongside (CAD viewers, PDF specs, past projects, government portals in adjacent browser tabs). 30–90 min on pricing work; 15–45 min on project phase updates. Often switches between several active items in a day. Rarely uses mobile, except for ad-hoc photo capture during a site visit (uploads later from desktop).

## Success measure

- Quote turnaround time (from assignment to "section submitted")
- Low post-acceptance scope changes — the technical scope was accurate the first time
- Zero scope misses caught by approvers (no "you forgot to exclude X" feedback)
- On-time phase delivery vs the planned Gantt
- Zero phases started against a non-`Issued` licence

## Friction risks

- **Memory-lapse slip** — forgetting to mark exclusions, leaving an assumption implicit, missing a deliverable that's standard for this service type. Mitigation: per-service templates with required-by-default fields; checklist that surfaces before submit ("3 of 5 standard sections still empty"); methodology card and gantt block prompts are inline drawers, not separate screens to remember to visit.
- **Mode error across the two roles** — same person, two activities, two surfaces (quote builder vs project execution). Switching context in the same login can blur "am I pricing or executing right now?" Mitigation: page chrome carries a strong activity signifier ("Pricing quote QUO-2026-0142" vs "Project P-2026-0091 · Phase 3 Safety Drawings"); destructive actions show the activity in the confirmation copy.
- **Description-similarity slip** — two services with similar names ("Architectural Design" vs "Architectural Supervision"), two licences with similar IDs (`BLDG-PRM-7821` vs `BLDG-PRM-7281`). Mitigation: pickers show full code + name + category; licence rows on the project show portal + issued-date in addition to ID.
- **Capture error across RFQs / projects** — multiple items open in tabs, text entered against the wrong one. Mitigation: each item has its own sticky header showing identity and a per-item auto-save flush.
- **Knowledge-based mistake on a licence-dependent phase** — engineer attempts to start a phase whose dependent licence isn't yet `Issued`. Mitigation: hard block at the start action with the dependent licence linked from the disabled button's tooltip; phase bar on the Gantt visibly paused (desaturated tone + dashed border) when blocked.
