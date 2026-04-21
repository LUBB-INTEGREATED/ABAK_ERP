-- Rename QuoteStatus enum values and add new ones (BR-07, BR-11, doc PART 3.4)
-- Maps: ACCEPTED -> WON, REJECTED -> LOST, VIEWED -> IN_DISCUSSION,
--       UNDER_NEGOTIATION -> IN_NEGOTIATION
-- Adds: IN_REVISION, POSTPONED, CANCELLED
BEGIN;

-- CreateEnum
CREATE TYPE "LossReason" AS ENUM (
  'PRICE',
  'COMPETITOR',
  'SCOPE_MISMATCH',
  'BUDGET_UNAVAILABLE',
  'POSTPONED',
  'NO_RESPONSE',
  'QUALITY_CONCERN',
  'INTERNAL',
  'OTHER'
);

-- QuoteStatus enum rebuild
CREATE TYPE "QuoteStatus_new" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'PENDING_APPROVAL',
  'IN_REVISION',
  'APPROVED',
  'SENT',
  'IN_DISCUSSION',
  'IN_NEGOTIATION',
  'REVISED',
  'WON',
  'LOST',
  'POSTPONED',
  'EXPIRED',
  'CANCELLED'
);

ALTER TABLE "quotes"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "QuoteStatus_new" USING (
    CASE "status"::text
      WHEN 'VIEWED' THEN 'IN_DISCUSSION'
      WHEN 'UNDER_NEGOTIATION' THEN 'IN_NEGOTIATION'
      WHEN 'ACCEPTED' THEN 'WON'
      WHEN 'REJECTED' THEN 'LOST'
      ELSE "status"::text
    END::"QuoteStatus_new"
  ),
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "QuoteStatus";
ALTER TYPE "QuoteStatus_new" RENAME TO "QuoteStatus";

-- Column renames (acceptedAt -> wonAt, rejectedAt -> lostAt, rejectedReason -> lostReason)
ALTER TABLE "quotes" RENAME COLUMN "acceptedAt" TO "wonAt";
ALTER TABLE "quotes" RENAME COLUMN "rejectedAt" TO "lostAt";
ALTER TABLE "quotes" RENAME COLUMN "rejectedReason" TO "lostReason";

-- New columns on quotes
ALTER TABLE "quotes"
  ADD COLUMN "lostReasonCode" "LossReason",
  ADD COLUMN "postponedUntil" TIMESTAMP(3),
  ADD COLUMN "cancelledAt"    TIMESTAMP(3),
  ADD COLUMN "parentQuoteId"  TEXT;

-- Self-referential FK for revisions
ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_parentQuoteId_fkey"
  FOREIGN KEY ("parentQuoteId") REFERENCES "quotes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
