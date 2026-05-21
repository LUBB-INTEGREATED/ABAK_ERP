# Sales Manager

## Role

Sales & Marketing Manager. Single individual (with delegation possible). Also wears the **System Admin** hat — owns `/admin/*` settings, service catalog, holiday calendar, audit log.

## Responsibilities in the system

- Assigns and re-assigns leads (or configures the auto-assignment strategy)
- Oversees the full pipeline across the team — stuck-lead intervention, re-prioritization, escalation
- Sets and adjusts monthly/quarterly sales targets per rep
- **Mid-tier quote and discount approval** per the configurable Pricing Policy (singleton in Admin Settings — owner picks tiered or sequential mode). Manager approves below the CEO escalation threshold.
- Reviews win/loss reasons, conversion trends
- Configures system settings (SLAs, lead channels, T&Cs and documents libraries, Pricing Policy, default behaviors) via Admin Settings

## Device + context

**Desktop primary** at the office — long sessions (15–60 min) for pipeline review, approvals, target adjustment, reports. **Mobile secondary** for tier-1 approvals when away from the desk and for the morning "what landed overnight" scan. Often has multiple browser tabs open across pipeline, approvals, and reports.

## Success measure

- Team conversion rate (lead → quote → won)
- On-time SLA compliance % across the team
- Target attainment per rep vs aggregate
- Win/loss reason distribution — fewer losses to "scope mismatch" or "no response" means qualification is healthy

## Friction risks

- **Mode error** — looks at filtered "Q1" pipeline data thinking it's the current quarter, or filtered-to-one-rep data thinking it's the whole team. Mitigation: the active filter is always a persistent visible chip with one-click clear, never a hidden default. The period selector is a chip in the page header, not buried.
- **Capture error on approval** — approves several similar quotes/discounts in succession and applies muscle memory to one that needed extra scrutiny. Mitigation: approval surface shows a commercial summary (margin, deviations from rate card, requested discount, change since last version) above the Approve button.
- **Alert fatigue** — notifications for every lead, stuck deal, target movement train them to dismiss without reading. Mitigation: notification settings let them mute by type; the bell groups by entity; only "needs your attention" items show a red dot.
- **Admin/operational confusion** — System Admin hat and Sales Manager hat share the same login. A "destructive" admin action (e.g., changing the SLA window, switching the Pricing Policy from Tiered to Sequential) could be triggered while in a sales mindset. Mitigation: `/admin/*` is visually distinct (different header tint, "Admin" label always visible); destructive admin actions require typed confirmation; the Pricing Policy save flow asks how to handle in-flight pending requests.
