# Department Manager

## Role

Head of one of ABAK's delivery departments (Architecture, Structural, MEP, Safety, Surveying, Licensing, Supervision, etc.). The triage point for every RFQ that touches their department, and the actor who turns a Won quote into a live project.

## Responsibilities in the system

- Receives every RFQ assigned to their department (the sales person picks departments at RFQ creation; the manager(s) of each picked department are notified)
- **Assigns a Department Engineer** (or themselves) to price each section their department owns
- For multi-department RFQs: coordinates with the other involved managers to designate the **Lead Pricer** — the single engineer who assembles and submits the consolidated quote
- Reviews their department's section of the priced quote before the Lead Pricer submits — catches scope misses, pricing anomalies, missing methodology
- Receives the "Quote Won" notification and **1-click converts** the quote into a Project (phases inherited from line items, departments inherited from sections, payment schedule + docs carried over)
- Wires **licence dependencies** on project phases — declares which phases cannot start until which licences are `Issued`
- Tracks their department's capacity (concurrent active RFQs + active project phases) and re-assigns when a pricer is overloaded

## Device + context

**Desktop primary** at the office — long sessions for RFQ triage, capacity planning, project setup. **Mobile secondary** for the morning "what landed overnight" scan and for the Won-to-Project conversion when away from the desk. Sessions are 5–30 minutes per RFQ, with a longer 30–60 minute block for project conversion + dependency wiring.

## Success measure

- RFQ triage turnaround (from RFQ-submitted to engineer-assigned) — target under 4 working hours
- Per-engineer capacity balance (no engineer stuck with 5 RFQs while another sits idle)
- Department's section quality at approval (zero rejections for "incomplete scope" or "missing methodology")
- Won-to-Project conversion turnaround — target same-day
- Correct licence dependency wiring (zero phases that start before their dependent licence is issued)

## Friction risks

- **Capture error on Lead Pricer designation** — manager assigns four pricers across departments but forgets to flag the lead. Mitigation: the multi-department assignment screen enforces exactly-one-lead as a constraint; the "Assign all" CTA is disabled until that's satisfied, with a tooltip explaining what's missing. Norman: exploit the power of constraints.
- **Description-similarity slip on engineers** — two engineers in the same department with similar names. Mitigation: UserPicker shows name + role + last-active timestamp; reuses the same component pattern used in RFQ assignment elsewhere.
- **Mode error on the 1-click conversion** — the conversion is reversible within 24h, but a manager might convert before realizing a final scope change is still being negotiated. Mitigation: the conversion CTA shows an inline preview of what will be created (phases, departments, payment schedule, docs); "Undo conversion" is visible on the project page for the first 24h.
- **Memory-lapse on licence wiring** — manager creates the project but forgets to wire which phases depend on which licences. The system can't infer this — it's domain knowledge. Mitigation: the project creation flow surfaces a "Licence dependencies" step as the last action of the conversion wizard; the wizard ends at that step rather than auto-dismissing, with a "Wire dependencies later" escape hatch that adds a project-level warning until done.
- **Knowledge-based mistake on quote section review** — the manager reviews their own department's section but doesn't catch missing T&Cs that are convention in their industry. Mitigation: the T&Cs library carries per-department defaults; the quote builder auto-suggests them on quote creation; manager review surface highlights any "default T&C not included" inline.
