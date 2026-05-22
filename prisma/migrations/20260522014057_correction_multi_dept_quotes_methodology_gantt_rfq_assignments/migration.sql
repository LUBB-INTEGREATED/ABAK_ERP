-- CreateEnum
CREATE TYPE "RfqAssignmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "RfqRequestStatus" AS ENUM ('PENDING', 'RESOLVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "quote_items" ADD COLUMN     "departmentId" TEXT;

-- CreateTable
CREATE TABLE "methodology_cards" (
    "id" TEXT NOT NULL,
    "quoteItemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "deliverable" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "methodology_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gantt_blocks" (
    "id" TEXT NOT NULL,
    "quoteItemId" TEXT NOT NULL,
    "startDay" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "categoryTone" TEXT NOT NULL DEFAULT '#2d7ad1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gantt_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_assignments" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "isLeadPricer" BOOLEAN NOT NULL DEFAULT false,
    "status" "RfqAssignmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfq_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_doc_requests" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RfqRequestStatus" NOT NULL DEFAULT 'PENDING',
    "response" TEXT,
    "attachmentUrl" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfq_doc_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_site_visit_requests" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "preferredDateFrom" TIMESTAMP(3),
    "preferredDateTo" TIMESTAMP(3),
    "status" "RfqRequestStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfq_site_visit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "methodology_cards_quoteItemId_key" ON "methodology_cards"("quoteItemId");

-- CreateIndex
CREATE UNIQUE INDEX "gantt_blocks_quoteItemId_key" ON "gantt_blocks"("quoteItemId");

-- CreateIndex
CREATE INDEX "rfq_assignments_rfqId_idx" ON "rfq_assignments"("rfqId");

-- CreateIndex
CREATE INDEX "rfq_assignments_assigneeId_idx" ON "rfq_assignments"("assigneeId");

-- CreateIndex
CREATE INDEX "rfq_assignments_departmentId_idx" ON "rfq_assignments"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "rfq_assignments_rfqId_departmentId_key" ON "rfq_assignments"("rfqId", "departmentId");

-- CreateIndex
CREATE INDEX "rfq_doc_requests_rfqId_idx" ON "rfq_doc_requests"("rfqId");

-- CreateIndex
CREATE INDEX "rfq_doc_requests_status_idx" ON "rfq_doc_requests"("status");

-- CreateIndex
CREATE INDEX "rfq_site_visit_requests_rfqId_idx" ON "rfq_site_visit_requests"("rfqId");

-- CreateIndex
CREATE INDEX "rfq_site_visit_requests_status_idx" ON "rfq_site_visit_requests"("status");

-- CreateIndex
CREATE INDEX "quote_items_departmentId_idx" ON "quote_items"("departmentId");

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "methodology_cards" ADD CONSTRAINT "methodology_cards_quoteItemId_fkey" FOREIGN KEY ("quoteItemId") REFERENCES "quote_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gantt_blocks" ADD CONSTRAINT "gantt_blocks_quoteItemId_fkey" FOREIGN KEY ("quoteItemId") REFERENCES "quote_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_assignments" ADD CONSTRAINT "rfq_assignments_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_assignments" ADD CONSTRAINT "rfq_assignments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_doc_requests" ADD CONSTRAINT "rfq_doc_requests_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_site_visit_requests" ADD CONSTRAINT "rfq_site_visit_requests_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

