-- BPD Compliance v3 Migration
-- Aligns all enums and fields with ABAK_ERP_BusinessProcess_Final_v3.docx
-- Uses RENAME VALUE (in-place, no data migration needed for renames)
-- and ADD VALUE for new entries.

-- ============================================================
-- 1. LeadStatus
--    Renames update in-place — existing rows migrate automatically.
--    Deprecated values (CONVERTED, LOST, DUPLICATE) left in type
--    but mapped away from data rows.
-- ============================================================

ALTER TYPE "LeadStatus" RENAME VALUE 'NEW'         TO 'INCOMING';
ALTER TYPE "LeadStatus" RENAME VALUE 'CONTACTED'   TO 'IN_PROGRESS';
ALTER TYPE "LeadStatus" RENAME VALUE 'UNQUALIFIED' TO 'DISQUALIFIED';

ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'TENDER_PENDING';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'TENDER_ACTIVE';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'TENDER_SUBMITTED';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'TENDER_WON';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'TENDER_LOST';

-- Migrate rows that used the deprecated values (now safe since new values exist)
UPDATE "leads" SET "status" = 'INCOMING'     WHERE "status" = 'CONVERTED';
UPDATE "leads" SET "status" = 'DISQUALIFIED' WHERE "status" = 'LOST';
UPDATE "leads" SET "status" = 'DISQUALIFIED' WHERE "status" = 'DUPLICATE';

-- ============================================================
-- 2. PipelineStage
--    RENAME VALUE migrates existing rows automatically.
--    New intermediate stages added with ADD VALUE.
-- ============================================================

ALTER TYPE "PipelineStage" RENAME VALUE 'INITIAL_CONTACT' TO 'FIRST_CONTACT_MADE';
ALTER TYPE "PipelineStage" RENAME VALUE 'QUALIFICATION'   TO 'MEETING_DONE';
ALTER TYPE "PipelineStage" RENAME VALUE 'RFQ_RECEIVED'    TO 'RFQ_SUBMITTED';
ALTER TYPE "PipelineStage" RENAME VALUE 'QUOTE_SENT'      TO 'QUOTE_SENT_TO_CLIENT';
ALTER TYPE "PipelineStage" RENAME VALUE 'NEGOTIATION'     TO 'NEGOTIATION_REVISION';

ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'MEETING_SCHEDULED';
ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'QUOTE_IN_PREPARATION';

-- ============================================================
-- 3. VisitType: complete replacement (no overlap between old/new names)
-- ============================================================

CREATE TYPE "VisitType_new" AS ENUM (
  'CLIENT_OFFICE',
  'SITE',
  'ABAK_OFFICE',
  'VIRTUAL',
  'EVENT'
);

ALTER TABLE "field_visits"
  ALTER COLUMN "visitType" TYPE "VisitType_new"
  USING CASE "visitType"::text
    WHEN 'INITIAL'      THEN 'CLIENT_OFFICE'
    WHEN 'FOLLOW_UP'    THEN 'CLIENT_OFFICE'
    WHEN 'TECHNICAL'    THEN 'SITE'
    WHEN 'PRESENTATION' THEN 'ABAK_OFFICE'
    WHEN 'CLOSING'      THEN 'ABAK_OFFICE'
    ELSE                     'CLIENT_OFFICE'
  END::"VisitType_new";

DROP TYPE "VisitType";
ALTER TYPE "VisitType_new" RENAME TO "VisitType";

-- ============================================================
-- 4. InteractionType: rename PHONE_CALL → CALL, INTERNAL_NOTE → NOTE
--    then recreate to add OFFICE_VISIT/QUOTE_SENT_EVENT/CONTRACT_SIGNED
--    and drop NEGOTIATION/TECHNICAL_CONSULTATION/PROPOSAL_SUBMISSION
-- ============================================================

ALTER TYPE "InteractionType" RENAME VALUE 'PHONE_CALL'    TO 'CALL';
ALTER TYPE "InteractionType" RENAME VALUE 'INTERNAL_NOTE' TO 'NOTE';
ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'OFFICE_VISIT';
ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'QUOTE_SENT_EVENT';
ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'CONTRACT_SIGNED';

-- Map deprecated values to MEETING before removing them
UPDATE "interactions" SET "type" = 'MEETING'
  WHERE "type" IN ('NEGOTIATION', 'TECHNICAL_CONSULTATION', 'PROPOSAL_SUBMISSION');

CREATE TYPE "InteractionType_new" AS ENUM (
  'CALL',
  'MEETING',
  'EMAIL',
  'WHATSAPP',
  'COMPLAINT',
  'SITE_VISIT',
  'OFFICE_VISIT',
  'QUOTE_SENT_EVENT',
  'CONTRACT_SIGNED',
  'NOTE'
);

ALTER TABLE "interactions"
  ALTER COLUMN "type" TYPE "InteractionType_new"
  USING "type"::text::"InteractionType_new";

DROP TYPE "InteractionType";
ALTER TYPE "InteractionType_new" RENAME TO "InteractionType";

-- ============================================================
-- 5. FollowUpStatus: add DUE_TODAY, remove IN_PROGRESS
-- ============================================================

ALTER TYPE "FollowUpStatus" ADD VALUE IF NOT EXISTS 'DUE_TODAY';

UPDATE "follow_ups" SET "status" = 'PENDING' WHERE "status" = 'IN_PROGRESS';

CREATE TYPE "FollowUpStatus_new" AS ENUM (
  'PENDING',
  'DUE_TODAY',
  'OVERDUE',
  'COMPLETED',
  'CANCELLED'
);

-- Drop default before type change, re-add after
ALTER TABLE "follow_ups" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "follow_ups"
  ALTER COLUMN "status" TYPE "FollowUpStatus_new"
  USING "status"::text::"FollowUpStatus_new";

ALTER TABLE "follow_ups" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"FollowUpStatus_new";

DROP TYPE "FollowUpStatus";
ALTER TYPE "FollowUpStatus_new" RENAME TO "FollowUpStatus";

-- ============================================================
-- 6. New enums
-- ============================================================

CREATE TYPE "InteractionVisibility" AS ENUM ('TEAM', 'MANAGER_ONLY', 'PRIVATE');
CREATE TYPE "ClientSentiment"       AS ENUM ('VERY_INTERESTED', 'INTERESTED', 'NEUTRAL', 'HESITANT', 'NOT_INTERESTED');

-- ============================================================
-- 7. New columns: Interaction
-- ============================================================

ALTER TABLE "interactions" ADD COLUMN "visibility" "InteractionVisibility" NOT NULL DEFAULT 'TEAM';

-- ============================================================
-- 8. New columns: FieldVisit
-- ============================================================

ALTER TABLE "field_visits" ADD COLUMN "keyOutcomes"     TEXT;
ALTER TABLE "field_visits" ADD COLUMN "clientSentiment" "ClientSentiment";
ALTER TABLE "field_visits" ADD COLUMN "attachmentUrls"  TEXT[] NOT NULL DEFAULT '{}';

-- ============================================================
-- 9. New columns: Lead (channel-specific + geographic)
-- ============================================================

ALTER TABLE "leads" ADD COLUMN "city"               TEXT;
ALTER TABLE "leads" ADD COLUMN "district"           TEXT;
ALTER TABLE "leads" ADD COLUMN "socialUsername"     TEXT;
ALTER TABLE "leads" ADD COLUMN "relatedCampaign"    TEXT;
ALTER TABLE "leads" ADD COLUMN "webSource"          TEXT;
ALTER TABLE "leads" ADD COLUMN "mapContactMethod"   TEXT;
ALTER TABLE "leads" ADD COLUMN "mapHowFoundUs"      TEXT;
ALTER TABLE "leads" ADD COLUMN "referralSourceType" TEXT;
ALTER TABLE "leads" ADD COLUMN "expectedBudgetRange" TEXT;
ALTER TABLE "leads" ADD COLUMN "clientUrgency"      TEXT;

-- ============================================================
-- 10. New columns: Quote (technical scope section)
-- ============================================================

ALTER TABLE "quotes" ADD COLUMN "scopeOfWork"       TEXT;
ALTER TABLE "quotes" ADD COLUMN "deliverables"      TEXT;
ALTER TABLE "quotes" ADD COLUMN "exclusions"        TEXT;
ALTER TABLE "quotes" ADD COLUMN "assumptions"       TEXT;
ALTER TABLE "quotes" ADD COLUMN "numberOfRevisions" INTEGER;
