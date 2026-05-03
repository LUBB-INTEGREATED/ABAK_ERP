-- Add clientType column to clients table
ALTER TABLE "clients" ADD COLUMN "clientType" TEXT;

-- Remove deprecated LeadStatus values by recreating the enum.
-- Deprecated values CONVERTED/LOST/DUPLICATE were already migrated to INCOMING/DISQUALIFIED
-- in bpd_compliance_v3 migration, so no rows use them.

-- Drop default before type change (required by PostgreSQL)
ALTER TABLE "leads" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "LeadStatus_new" AS ENUM (
  'INCOMING',
  'ASSIGNED',
  'IN_PROGRESS',
  'QUALIFIED',
  'DISQUALIFIED',
  'TENDER_PENDING',
  'TENDER_ACTIVE',
  'TENDER_SUBMITTED',
  'TENDER_WON',
  'TENDER_LOST'
);

ALTER TABLE "leads"
  ALTER COLUMN "status" TYPE "LeadStatus_new"
  USING "status"::text::"LeadStatus_new";

DROP TYPE "LeadStatus";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";

-- Re-add default after type change
ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'INCOMING'::"LeadStatus";
