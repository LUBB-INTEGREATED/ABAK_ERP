-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('RECEIVED', 'ASSIGNED', 'IN_PREPARATION', 'PENDING_APPROVAL', 'APPROVED_READY_FOR_DISPATCH', 'SENT', 'WON', 'LOST', 'POSTPONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RfqSource" AS ENUM ('SALES_MANAGER', 'INTERNAL_REP', 'BROKER', 'SOCIAL', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "RfqPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "RfqDispatchChannel" AS ENUM ('WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "ConfirmationType" AS ENUM ('PAYMENT', 'PO', 'CONTRACT');

-- CreateEnum
CREATE TYPE "RfqQualityScore" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'PENDING');

-- AlterEnum
ALTER TYPE "PipelineStage" ADD VALUE 'READY_FOR_RFQ';

-- AlterTable
ALTER TABLE "pipeline_entries" ADD COLUMN     "nextStep" TEXT,
ADD COLUMN     "readyForRfqAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "rfqs" (
    "id" TEXT NOT NULL,
    "rfqNumber" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "projectScope" TEXT NOT NULL,
    "priority" "RfqPriority" NOT NULL DEFAULT 'NORMAL',
    "requestedByChannel" "RfqSource" NOT NULL,
    "brokerName" TEXT,
    "brokerPhone" TEXT,
    "coordinatorId" TEXT,
    "coordinatorAssignedAt" TIMESTAMP(3),
    "technicalContributorId" TEXT,
    "financialReviewerId" TEXT,
    "originalSalesRepId" TEXT,
    "status" "RfqStatus" NOT NULL DEFAULT 'RECEIVED',
    "quoteId" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "dispatchedVia" "RfqDispatchChannel",
    "confirmationType" "ConfirmationType",
    "confirmationAt" TIMESTAMP(3),
    "confirmationValue" DOUBLE PRECISION,
    "confirmationDocUrl" TEXT,
    "lostReason" TEXT,
    "postponedUntil" TIMESTAMP(3),
    "qualityScore" "RfqQualityScore" NOT NULL DEFAULT 'PENDING',
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rfqs_rfqNumber_key" ON "rfqs"("rfqNumber");

-- CreateIndex
CREATE UNIQUE INDEX "rfqs_opportunityId_key" ON "rfqs"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "rfqs_quoteId_key" ON "rfqs"("quoteId");

-- CreateIndex
CREATE INDEX "rfqs_rfqNumber_idx" ON "rfqs"("rfqNumber");

-- CreateIndex
CREATE INDEX "rfqs_clientId_idx" ON "rfqs"("clientId");

-- CreateIndex
CREATE INDEX "rfqs_coordinatorId_idx" ON "rfqs"("coordinatorId");

-- CreateIndex
CREATE INDEX "rfqs_status_idx" ON "rfqs"("status");

-- CreateIndex
CREATE INDEX "rfqs_createdAt_idx" ON "rfqs"("createdAt");

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "pipeline_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_technicalContributorId_fkey" FOREIGN KEY ("technicalContributorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_financialReviewerId_fkey" FOREIGN KEY ("financialReviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_originalSalesRepId_fkey" FOREIGN KEY ("originalSalesRepId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
