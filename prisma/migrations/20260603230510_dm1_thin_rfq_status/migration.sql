-- DM-1: thin RFQ — collapse RfqStatus to intake-only states.
-- Lifecycle/terminal states (SENT/WON/LOST/POSTPONED/…) now live ONLY on the
-- Quote; the sales-facing status is DERIVED from rfq.quote.status
-- (see packages/api/src/modules/rfqs/rfq-display-status.ts). Deprecated RFQ
-- columns (coordinatorId, dispatchedAt, confirmation*, lostReason, …) are kept
-- read-only for audit and are simply no longer written.

-- 1. Decline ("Not us") audit — additive.
CREATE TYPE "RfqDeclineType" AS ENUM ('WRONG_DEPT', 'NO_BID');

ALTER TABLE "rfqs"
  ADD COLUMN "declineType"   "RfqDeclineType",
  ADD COLUMN "declineReason" TEXT,
  ADD COLUMN "declinedById"  TEXT,
  ADD COLUMN "declinedAt"    TIMESTAMP(3);

-- 2. Collapse RfqStatus 10 -> 5. A CASE remap is used instead of Prisma's plain
--    `status::text::"RfqStatus_new"` cast so rows holding removed values migrate
--    cleanly. Every non-intake legacy state folds to PRICING; its real state is
--    read from the linked quote.
CREATE TYPE "RfqStatus_new" AS ENUM ('SUBMITTED', 'ASSIGNED', 'PRICING', 'CANCELLED', 'DECLINED');

ALTER TABLE "rfqs" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "rfqs" ALTER COLUMN "status" TYPE "RfqStatus_new" USING (
  CASE "status"::text
    WHEN 'RECEIVED'                     THEN 'SUBMITTED'
    WHEN 'ASSIGNED'                     THEN 'ASSIGNED'
    WHEN 'IN_PREPARATION'              THEN 'PRICING'
    WHEN 'PENDING_APPROVAL'            THEN 'PRICING'
    WHEN 'APPROVED_READY_FOR_DISPATCH' THEN 'PRICING'
    WHEN 'SENT'                        THEN 'PRICING'
    WHEN 'WON'                         THEN 'PRICING'
    WHEN 'LOST'                        THEN 'PRICING'
    WHEN 'POSTPONED'                   THEN 'PRICING'
    WHEN 'CANCELLED'                   THEN 'CANCELLED'
    ELSE 'SUBMITTED'
  END::"RfqStatus_new"
);

ALTER TABLE "rfqs" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

DROP TYPE "RfqStatus";
ALTER TYPE "RfqStatus_new" RENAME TO "RfqStatus";
