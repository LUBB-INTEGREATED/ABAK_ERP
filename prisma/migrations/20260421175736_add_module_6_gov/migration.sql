-- CreateEnum
CREATE TYPE "GovAuthorityCategory" AS ENUM ('MUNICIPALITY', 'MINISTRY', 'UTILITY', 'PLATFORM_ETIMAD', 'PLATFORM_FURSA', 'OTHER');

-- CreateEnum
CREATE TYPE "GovTxStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PRO';

-- CreateTable
CREATE TABLE "gov_transactions" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorityName" TEXT NOT NULL,
    "authorityCategory" "GovAuthorityCategory" NOT NULL,
    "transactionType" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "assignedProId" TEXT,
    "assignedEngineerId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "expectedResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "status" "GovTxStatus" NOT NULL DEFAULT 'SUBMITTED',
    "fees" DOUBLE PRECISION,
    "feesPaid" BOOLEAN NOT NULL DEFAULT false,
    "feesPaidAt" TIMESTAMP(3),
    "weeklyStatusLastAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "gov_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gov_visits" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "visitedById" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL,
    "outcome" TEXT,
    "nextAction" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gov_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gov_comments" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "commentText" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "responseText" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gov_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gov_documents" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,

    CONSTRAINT "gov_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gov_transactions_transactionNumber_key" ON "gov_transactions"("transactionNumber");

-- CreateIndex
CREATE INDEX "gov_transactions_projectId_idx" ON "gov_transactions"("projectId");

-- CreateIndex
CREATE INDEX "gov_transactions_transactionNumber_idx" ON "gov_transactions"("transactionNumber");

-- CreateIndex
CREATE INDEX "gov_transactions_assignedProId_idx" ON "gov_transactions"("assignedProId");

-- CreateIndex
CREATE INDEX "gov_transactions_status_idx" ON "gov_transactions"("status");

-- CreateIndex
CREATE INDEX "gov_visits_transactionId_idx" ON "gov_visits"("transactionId");

-- CreateIndex
CREATE INDEX "gov_visits_visitedById_idx" ON "gov_visits"("visitedById");

-- CreateIndex
CREATE INDEX "gov_visits_visitedAt_idx" ON "gov_visits"("visitedAt");

-- CreateIndex
CREATE INDEX "gov_comments_transactionId_idx" ON "gov_comments"("transactionId");

-- CreateIndex
CREATE INDEX "gov_documents_transactionId_idx" ON "gov_documents"("transactionId");

-- AddForeignKey
ALTER TABLE "gov_transactions" ADD CONSTRAINT "gov_transactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gov_transactions" ADD CONSTRAINT "gov_transactions_assignedProId_fkey" FOREIGN KEY ("assignedProId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gov_transactions" ADD CONSTRAINT "gov_transactions_assignedEngineerId_fkey" FOREIGN KEY ("assignedEngineerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gov_visits" ADD CONSTRAINT "gov_visits_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "gov_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gov_visits" ADD CONSTRAINT "gov_visits_visitedById_fkey" FOREIGN KEY ("visitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gov_comments" ADD CONSTRAINT "gov_comments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "gov_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gov_comments" ADD CONSTRAINT "gov_comments_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gov_documents" ADD CONSTRAINT "gov_documents_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "gov_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
