-- CreateEnum
CREATE TYPE "LeadChannel" AS ENUM ('GOVERNMENT_TENDER', 'REFERRAL', 'WALK_IN', 'SOCIAL_MEDIA', 'WEBSITE', 'GOOGLE_MAPS');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'ASSIGNED', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SLAStatus" AS ENUM ('ON_TIME', 'DUE_SOON', 'OVERDUE');

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "leadNumber" TEXT NOT NULL,
    "channel" "LeadChannel" NOT NULL,
    "source" TEXT,
    "referenceNumber" TEXT,
    "contactName" TEXT NOT NULL,
    "companyName" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "serviceId" TEXT,
    "serviceDetails" TEXT,
    "projectLocation" TEXT,
    "projectSize" TEXT,
    "budget" DOUBLE PRECISION,
    "timeline" TEXT,
    "etimadNumber" TEXT,
    "fursaNumber" TEXT,
    "tenderDeadline" TIMESTAMP(3),
    "tenderDetails" JSONB,
    "referredBy" TEXT,
    "referrerPhone" TEXT,
    "referrerCompany" TEXT,
    "socialPlatform" TEXT,
    "socialProfile" TEXT,
    "mapsLink" TEXT,
    "mapsReview" BOOLEAN,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "slaResponseDue" TIMESTAMP(3),
    "slaStatus" "SLAStatus" NOT NULL DEFAULT 'ON_TIME',
    "firstResponseAt" TIMESTAMP(3),
    "isReturningClient" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT,
    "qualificationScore" INTEGER DEFAULT 0,
    "qualificationNotes" TEXT,
    "initialNotes" TEXT,
    "lostReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_leadNumber_key" ON "leads"("leadNumber");

-- CreateIndex
CREATE INDEX "leads_leadNumber_idx" ON "leads"("leadNumber");

-- CreateIndex
CREATE INDEX "leads_channel_idx" ON "leads"("channel");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_assignedToId_idx" ON "leads"("assignedToId");

-- CreateIndex
CREATE INDEX "leads_slaStatus_idx" ON "leads"("slaStatus");

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");

-- CreateIndex
CREATE INDEX "leads_serviceId_idx" ON "leads"("serviceId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
