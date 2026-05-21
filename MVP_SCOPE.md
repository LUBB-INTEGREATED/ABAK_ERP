# MVP Scope — ABAK ERP

**Status:** Pinned 2026-05-18. Source of truth for what ships in the v1 deliverable under contract `ABAK-2026-QT-234` (27,000 SAR / 70 working days).

This document overrides any later spec docs (including `Process/ABAK_ERP_UX_Specification_v2.md`) until a written addendum is signed per **Contract Article 10**.

---

## In scope — the four contracted modules

The contract (Article 1) names exactly four modules. Everything we ship in v1 must serve one of them:

| Module                   | Surface in app                         | Primary routes                               |
| ------------------------ | -------------------------------------- | -------------------------------------------- |
| **CRM**                  | Clients 360°, interactions, follow-ups | `/clients`, `/leads`                         |
| **Sales Management**     | Pipeline, RFQs, field visits           | `/pipeline`, `/rfqs`                         |
| **Quotations & Pricing** | Quote builder, approvals, PDF, PO      | `/quotes`                                    |
| **Project Management**   | Project execution, Gantt, finance, gov | `/projects`, `/finance`, `/gov-transactions` |

Plus the cross-cutting **Reports** (`/reports`) and **Admin** (`/admin/*`) surfaces that the four modules depend on.

The sidebar is grouped to communicate this spine:

```
Overview
─ Sales       Leads · Clients · Pipeline · RFQs · Quotes
─ Delivery    Projects · Finance · Gov Transactions
─ Insight     Reports
─ Admin       Services · System settings · Public holidays · Audit log
```

## Hidden but built — addendum territory

The following routes exist in the codebase but are **not linked from the sidebar** in MVP. They came out of earlier sprints or v2-spec experiments and stay deferred until a paid addendum:

- `/marketing` — Module 5 of the original 5-module BPD; not in the 4-module contract
- `/executive` — Executive dashboard; insight beyond the contracted Reports surface
- `/pro` — PRO (government delegate) dashboard; v2-spec role
- `/targets` — Team-target management; v2-spec feature beyond Sales Management's basic targets
- `/projects/resources` — Resource workload matrix; v2-spec PMO Layer
- `/notifications` as a nav item — the bell icon and `/notifications/*` page remain reachable; just not surfaced as a primary nav link

These routes are reachable by direct URL for internal QA but invisible to MVP users. Re-link from the sidebar only after the addendum is signed.

## Explicitly **out of scope** for v1

Anything from the v2 UX spec that adds new top-level concepts:

- Client Portal
- External Consultant Magic-Link access
- PMO Layer (cross-project resourcing, capacity planning)
- Org Mode / Project Mode dual sidebar
- Role Builder UI
- Authority Dependency Graph
- ABAC permission model beyond current role-based gating
- Engineering Document Control with diff viewer
- Multi-Role-per-Project assignment matrix

These would each blow the contract envelope on their own. They are **not** silently in scope just because they appear in the v2 spec doc.

## Scope-change protocol

Per **Article 10**: any addition needs a written addendum quantifying time and cost impact.
Per **Article 16**: only email between `Projects@lubbintegrated.com` ↔ `Abdullah.mohsen@abak.com.sa` is binding — WhatsApp and verbal asks do not modify scope.
Per **Article 17**: when the contract is silent, the original `BPD-FINAL-2026` (4 modules) prevails. The v2 UX spec is **not** a binding amendment.

## Pragmatic exception

Small UX additions that _ease_ one of the four contracted modules — without introducing a new route, role, or permission concept — may be absorbed silently. Examples that qualify: better empty states, status-color tokens, a user picker where there was a raw UUID field. Examples that do **not** qualify: a new sidebar item, a new role, a new approval chain, a new entity type.

When in doubt, default to "addendum item" and surface it for explicit sign-off.
