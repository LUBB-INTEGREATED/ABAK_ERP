-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'AT_RISK', 'CLOSING', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PhaseCode" AS ENUM ('INITIATION', 'KICKOFF', 'EXECUTION', 'REVIEW', 'SUBMISSION', 'REVISIONS', 'CLOSURE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PhaseStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'UNDER_REVIEW', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "projectNumber" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "rfqId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pmId" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "startDate" TIMESTAMP(3),
    "expectedEndDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "contractValue" DOUBLE PRECISION NOT NULL,
    "plannedProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "financialRiskFlagged" BOOLEAN NOT NULL DEFAULT false,
    "financialRiskFlaggedAt" TIMESTAMP(3),
    "financialRiskReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phases" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phaseCode" "PhaseCode" NOT NULL,
    "customLabel" TEXT,
    "position" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "PhaseStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pmAdjustment" DOUBLE PRECISION,
    "pmAdjustmentNote" TEXT,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT true,
    "evidenceNote" TEXT,
    "clientAcknowledgedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "estimatedHours" DOUBLE PRECISION,
    "actualHours" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" TEXT NOT NULL,
    "dependentId" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closure_checklists" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "allPhasesCompleted" BOOLEAN NOT NULL DEFAULT false,
    "allPhasesCompletedAt" TIMESTAMP(3),
    "allPhasesCompletedById" TEXT,
    "deliverablesSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "deliverablesSubmittedAt" TIMESTAMP(3),
    "deliverablesSubmittedById" TEXT,
    "clientApprovalReceived" BOOLEAN NOT NULL DEFAULT false,
    "clientApprovalReceivedAt" TIMESTAMP(3),
    "clientApprovalReceivedById" TEXT,
    "finalPaymentReceived" BOOLEAN NOT NULL DEFAULT false,
    "finalPaymentReceivedAt" TIMESTAMP(3),
    "finalPaymentReceivedById" TEXT,
    "financeClearanceIssued" BOOLEAN NOT NULL DEFAULT false,
    "financeClearanceIssuedAt" TIMESTAMP(3),
    "financeClearanceIssuedById" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initiatedById" TEXT,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "closure_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_projectNumber_key" ON "projects"("projectNumber");

-- CreateIndex
CREATE UNIQUE INDEX "projects_poId_key" ON "projects"("poId");

-- CreateIndex
CREATE INDEX "projects_projectNumber_idx" ON "projects"("projectNumber");

-- CreateIndex
CREATE INDEX "projects_clientId_idx" ON "projects"("clientId");

-- CreateIndex
CREATE INDEX "projects_pmId_idx" ON "projects"("pmId");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "phases_projectId_idx" ON "phases"("projectId");

-- CreateIndex
CREATE INDEX "phases_ownerId_idx" ON "phases"("ownerId");

-- CreateIndex
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");

-- CreateIndex
CREATE INDEX "tasks_phaseId_idx" ON "tasks"("phaseId");

-- CreateIndex
CREATE INDEX "tasks_assigneeId_idx" ON "tasks"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_dependentId_blockerId_key" ON "task_dependencies"("dependentId", "blockerId");

-- CreateIndex
CREATE UNIQUE INDEX "closure_checklists_projectId_key" ON "closure_checklists"("projectId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_pmId_fkey" FOREIGN KEY ("pmId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phases" ADD CONSTRAINT "phases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phases" ADD CONSTRAINT "phases_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_dependentId_fkey" FOREIGN KEY ("dependentId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure_checklists" ADD CONSTRAINT "closure_checklists_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
