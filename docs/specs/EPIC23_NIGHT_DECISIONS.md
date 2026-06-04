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
