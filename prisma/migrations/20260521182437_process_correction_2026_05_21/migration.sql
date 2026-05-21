-- ============================================================
-- Process correction migration (2026-05-21)
-- See docs/CORRECTED_CLIENT_JOURNEY.md for the full rationale.
--
-- Changes:
-- 1. LeadChannel enum cleanup: drop GOVERNMENT_TENDER, add PHONE,
--    EXISTING_CLIENT_REPEAT, OTHER. Existing GOVERNMENT_TENDER rows
--    are migrated to OTHER before the type swap.
-- 2. Interaction model broadened: clientId now nullable; added
--    leadId, rfqId, projectId, ccAuthorIds[], followUpDate. This
--    makes Interaction the canonical communications-log primitive.
-- 3. Phase: added licenceOverrideJustification / By / At for
--    CEO-exemption flow.
-- 4. Project: added timelineState (ACTIVE/PAUSED) +
--    pausedSecondsTotal, plus licences relation.
-- 5. New tables: pricing_policy (singleton), licences (project-
--    scoped), _PhaseLicenceDependencies (many-to-many join).
-- ============================================================

-- CreateEnum
CREATE TYPE "ProjectTimelineState" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "PricingPolicyMode" AS ENUM ('TIERED', 'SEQUENTIAL');

-- CreateEnum
CREATE TYPE "LicenceStatus" AS ENUM ('APPLIED', 'UNDER_REVIEW', 'ISSUED', 'REJECTED');

-- ============================================================
-- LeadChannel enum swap: drop GOVERNMENT_TENDER, add PHONE +
-- EXISTING_CLIENT_REPEAT + OTHER. Use a 3-step swap pattern.
-- ============================================================

-- Create the new enum type with the corrected values.
CREATE TYPE "LeadChannel_new" AS ENUM ('REFERRAL', 'WALK_IN', 'PHONE', 'EXISTING_CLIENT_REPEAT', 'SOCIAL_MEDIA', 'WEBSITE', 'GOOGLE_MAPS', 'AI_CHATBOT', 'OTHER');

-- Temporarily drop the old enum's NOT NULL constraint by switching the
-- channel column to TEXT, remapping GOVERNMENT_TENDER → OTHER, then
-- casting to the new enum.
ALTER TABLE "leads" ALTER COLUMN "channel" TYPE TEXT USING ("channel"::text);
UPDATE "leads" SET "channel" = 'OTHER' WHERE "channel" = 'GOVERNMENT_TENDER';
ALTER TABLE "leads" ALTER COLUMN "channel" TYPE "LeadChannel_new" USING ("channel"::"LeadChannel_new");

-- Swap the type names; drop the old.
ALTER TYPE "LeadChannel" RENAME TO "LeadChannel_old";
ALTER TYPE "LeadChannel_new" RENAME TO "LeadChannel";
DROP TYPE "LeadChannel_old";

-- ============================================================
-- Interaction model — broaden scope from client-only to
-- lead/client/rfq/project + add CC + follow-up.
-- ============================================================

ALTER TABLE "interactions"
  ADD COLUMN "ccAuthorIds" TEXT[],
  ADD COLUMN "followUpDate" TIMESTAMP(3),
  ADD COLUMN "leadId" TEXT,
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "rfqId" TEXT,
  ALTER COLUMN "clientId" DROP NOT NULL;

-- ============================================================
-- Phase — add CEO licence-exemption override fields.
-- ============================================================

ALTER TABLE "phases"
  ADD COLUMN "licenceOverrideAt" TIMESTAMP(3),
  ADD COLUMN "licenceOverrideById" TEXT,
  ADD COLUMN "licenceOverrideJustification" TEXT;

-- ============================================================
-- Project — timeline state for licence-dependent pause behavior.
-- ============================================================

ALTER TABLE "projects"
  ADD COLUMN "pausedSecondsTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "timelineState" "ProjectTimelineState" NOT NULL DEFAULT 'ACTIVE';

-- ============================================================
-- Pricing Policy singleton.
-- ============================================================

CREATE TABLE "pricing_policy" (
    "id" TEXT NOT NULL,
    "salesCeilingPct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "mode" "PricingPolicyMode" NOT NULL DEFAULT 'TIERED',
    "tiers" JSONB NOT NULL DEFAULT '[]',
    "sequence" JSONB NOT NULL DEFAULT '[]',
    "vatPct" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_policy_pkey" PRIMARY KEY ("id")
);

-- Seed a sensible default policy so the system has a working chain on day 1.
-- Tiered: <= sales ceiling (5%) → no approval; ≤ 10% → Sales Manager;
-- > 10% → Sales Manager then CEO.
INSERT INTO "pricing_policy" ("id", "salesCeilingPct", "mode", "tiers", "sequence", "vatPct", "currency", "updatedAt")
VALUES (
  'default-policy',
  5,
  'TIERED',
  '[{"upToPct": 10, "approver": "SALES_MANAGER"}, {"upToPct": 100, "approver": "CEO"}]'::jsonb,
  '[]'::jsonb,
  15,
  'SAR',
  CURRENT_TIMESTAMP
);

-- ============================================================
-- Licences — project-scoped government licence records.
-- Replaces the standalone gov_transactions module.
-- ============================================================

CREATE TABLE "licences" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "portalName" TEXT NOT NULL,
    "portalUrl" TEXT,
    "requestId" TEXT,
    "status" "LicenceStatus" NOT NULL DEFAULT 'APPLIED',
    "appliedDate" TIMESTAMP(3) NOT NULL,
    "issuedDate" TIMESTAMP(3),
    "rejectedDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "appliedById" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "reminderCadenceDays" INTEGER NOT NULL DEFAULT 5,
    "parentLicenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "licences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_PhaseLicenceDependencies" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- Indexes.
CREATE INDEX "licences_projectId_idx" ON "licences"("projectId");
CREATE INDEX "licences_status_idx" ON "licences"("status");
CREATE INDEX "licences_appliedDate_idx" ON "licences"("appliedDate");
CREATE INDEX "licences_deletedAt_idx" ON "licences"("deletedAt");
CREATE UNIQUE INDEX "_PhaseLicenceDependencies_AB_unique" ON "_PhaseLicenceDependencies"("A", "B");
CREATE INDEX "_PhaseLicenceDependencies_B_index" ON "_PhaseLicenceDependencies"("B");
CREATE INDEX "interactions_leadId_idx" ON "interactions"("leadId");
CREATE INDEX "interactions_rfqId_idx" ON "interactions"("rfqId");
CREATE INDEX "interactions_projectId_idx" ON "interactions"("projectId");

-- Foreign keys.
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_rfqId_fkey"
  FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "licences" ADD CONSTRAINT "licences_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "licences" ADD CONSTRAINT "licences_parentLicenceId_fkey"
  FOREIGN KEY ("parentLicenceId") REFERENCES "licences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_PhaseLicenceDependencies" ADD CONSTRAINT "_PhaseLicenceDependencies_A_fkey"
  FOREIGN KEY ("A") REFERENCES "licences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PhaseLicenceDependencies" ADD CONSTRAINT "_PhaseLicenceDependencies_B_fkey"
  FOREIGN KEY ("B") REFERENCES "phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
