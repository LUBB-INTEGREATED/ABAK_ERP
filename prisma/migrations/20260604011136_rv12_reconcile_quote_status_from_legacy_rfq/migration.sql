-- RV-12: reconcile quote.status from the preserved (deprecated) RFQ outcome
-- columns. The DM-1 collapse folded WON/LOST/SENT/POSTPONED RfqStatus into
-- PRICING and now derives the sales-facing status from quote.status. But the
-- pre-DM-1 code maintained rfq.status (via recordOutcome) and quote.status
-- independently, so an RFQ whose outcome was recorded without the linked quote
-- being separately advanced now displays a stale quote status. This advances
-- such quotes from the deprecated RFQ columns that DM-1 deliberately preserved.
--
-- Idempotent: every UPDATE only touches quotes that are BEHIND the implied
-- outcome (guarded by `status NOT IN (terminal…)`), so re-running is a no-op.
-- No-op where the deprecated columns are NULL (the current dev DB has zero
-- such rows). Precedence: WON > LOST > POSTPONED > SENT.

-- WON — the RFQ carried a commercial confirmation.
UPDATE "quotes" q
SET "status" = 'WON',
    "wonAt" = COALESCE(q."wonAt", r."confirmationAt", NOW())
FROM "rfqs" r
WHERE r."quoteId" = q."id"
  AND r."confirmationType" IS NOT NULL
  AND q."status" NOT IN ('WON', 'LOST', 'POSTPONED', 'CANCELLED');

-- LOST — the RFQ recorded a loss reason and was not won.
UPDATE "quotes" q
SET "status" = 'LOST',
    "lostAt" = COALESCE(q."lostAt", NOW()),
    "lostReason" = COALESCE(q."lostReason", r."lostReason")
FROM "rfqs" r
WHERE r."quoteId" = q."id"
  AND r."lostReason" IS NOT NULL
  AND q."status" NOT IN ('WON', 'LOST', 'POSTPONED', 'CANCELLED');

-- POSTPONED — the RFQ recorded a postpone date.
UPDATE "quotes" q
SET "status" = 'POSTPONED',
    "postponedUntil" = COALESCE(q."postponedUntil", r."postponedUntil")
FROM "rfqs" r
WHERE r."quoteId" = q."id"
  AND r."postponedUntil" IS NOT NULL
  AND q."status" NOT IN ('WON', 'LOST', 'POSTPONED', 'CANCELLED');

-- SENT — the RFQ was dispatched but the quote is still pre-send.
UPDATE "quotes" q
SET "status" = 'SENT',
    "sentAt" = COALESCE(q."sentAt", r."dispatchedAt", NOW())
FROM "rfqs" r
WHERE r."quoteId" = q."id"
  AND r."dispatchedAt" IS NOT NULL
  AND q."status" IN ('DRAFT', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'IN_REVISION', 'REVISED');
