-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'CONVERTED';

-- AlterTable
ALTER TABLE "rfqs" ADD COLUMN     "requestedCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Data backfill (A1): clients created before the owner-default fix were left
-- with a NULL accountManagerId and are therefore invisible to their creator
-- under OWN scope. Re-home them to their creator so they reappear in the
-- creating rep's scoped list. (No enum dependency -> safe in this transaction.)
UPDATE "clients"
SET "accountManagerId" = "createdBy"
WHERE "accountManagerId" IS NULL
  AND "createdBy" IS NOT NULL
  AND "deletedAt" IS NULL;
