# Sales Rep

## Role

Field sales representative at ABAK. The system's highest-volume user. Typically 2–4 reps on the team.

## Responsibilities in the system

- Captures leads from the active channels (referral, walk-in, social, website, Google Maps, phone, existing-client repeat, other) — most often via the manual intake form when out in the field
- **Single thread-of-record for the client.** Owns the communications log — every call, WhatsApp, email, meeting, site visit gets logged here, regardless of who at ABAK made the contact (engineers logging site-visit coordination CC the sales person automatically)
- Moves opportunities through pipeline stages (New → Contacted → Negotiation → Ready for RFQ → RFQ Submitted → Won/Lost/Postponed)
- Plans and logs field visits
- **Requests RFQs** — picks the departments involved (1 or many) and submits; submission auto-qualifies the lead and notifies the involved department managers
- Receives the priced quote, sends to client, negotiates
- Grants discounts within the configured sales ceiling; requests approval above the ceiling
- Marks the quote Won / Lost / Postponed with mandatory reason
- Closes out follow-ups they own

## Device + context

**Mobile primary** (Android most common). Short sessions — 30 seconds to 3 minutes — repeated dozens of times across the day. Standing, in the car between visits, in a waiting room. Opens desktop only at the end of the day for longer admin (bulk updates, longer notes). Signal is intermittent at client sites and inside government buildings.

## Success measure

- Number of qualified leads moved to RFQ this month
- SAR pipeline value owned vs. monthly target
- SLA response-time compliance (no "Overdue" on the bell)
- Conversion rate from their leads

## Friction risks

- **Memory-lapse slip** — forgetting to log the visit interaction same-day, missing required fields under time pressure. Mitigation: form fields ordered by importance, auto-save drafts, "Save and continue later" as a peer to "Save & submit."
- **Description-similarity slip** — two clients with near-identical names ("Al-Faisal Holding" vs "Al-Faisal Group"). Mitigation: picker shows CR# / city / phone tail, not just name.
- **Offline gaps** — basement parking, site interior, government building. Mitigation: key write actions (log visit, capture lead, change stage) work offline and sync when reconnected.
- **Capture error** — common rapid action overrides an intended rare one (e.g., the muscle-memory "Save" press during an unusual workflow). Mitigation: destructive or unusual actions get an extra click and a different position.
