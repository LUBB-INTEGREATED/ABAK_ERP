-- A-24 (P2 — real money bug): prevent broker-commission DOUBLE-ACCRUAL.
--
-- QuotesService.accept() accrues an auto broker commission once per RFQ with a
-- check-then-insert guard (tx.commission.findFirst -> if (!existing) create)
-- inside a READ COMMITTED $transaction. With no DB-level uniqueness, two
-- concurrent accept() calls on the same RFQ each read "no existing row" and
-- both INSERT, double-accruing a real payout.
--
-- Fix: a PARTIAL UNIQUE INDEX on the auto-accrued broker rows (one per rfqId).
-- It is partial (WHERE "beneficiaryType" = 'BROKER') so it ONLY constrains the
-- auto-accrued broker commissions and never blocks legitimately-distinct
-- SALES_REP / REFERRAL_SOURCE commissions that may share an rfqId. The service
-- catches the resulting P2002 from the losing concurrent insert and treats it as
-- the once-guard (idempotent), so exactly one row survives.
CREATE UNIQUE INDEX "commissions_rfqId_broker_unique"
  ON "commissions" ("rfqId")
  WHERE "beneficiaryType" = 'BROKER';
