-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('NEW_LEAD', 'INITIAL_CONTACT', 'QUALIFICATION', 'RFQ_RECEIVED', 'QUOTE_SENT', 'NEGOTIATION', 'WON', 'LOST', 'POSTPONED');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('INITIAL', 'FOLLOW_UP', 'TECHNICAL', 'PRESENTATION', 'CLOSING');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('REVENUE', 'QUOTES_SENT', 'CONVERSIONS', 'VISITS');

-- CreateEnum
CREATE TYPE "TargetPeriod" AS ENUM ('MONTHLY', 'QUARTERLY');

-- CreateTable
CREATE TABLE "pipeline_entries" (
    "id" TEXT NOT NULL,
    "stage" "PipelineStage" NOT NULL DEFAULT 'NEW_LEAD',
    "leadId" TEXT,
    "clientId" TEXT,
    "ownerId" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "probability" INTEGER DEFAULT 10,
    "expectedCloseAt" TIMESTAMP(3),
    "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lostReason" TEXT,
    "postponedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "pipeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_transitions" (
    "id" TEXT NOT NULL,
    "pipelineEntryId" TEXT NOT NULL,
    "fromStage" "PipelineStage" NOT NULL,
    "toStage" "PipelineStage" NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "durationSeconds" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_visits" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "visitType" "VisitType" NOT NULL,
    "purpose" TEXT NOT NULL,
    "findings" TEXT,
    "nextAction" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "locationLabel" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "attendees" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_targets" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" "TargetType" NOT NULL,
    "period" "TargetPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "achievedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_entries_leadId_key" ON "pipeline_entries"("leadId");

-- CreateIndex
CREATE INDEX "pipeline_entries_stage_idx" ON "pipeline_entries"("stage");

-- CreateIndex
CREATE INDEX "pipeline_entries_ownerId_idx" ON "pipeline_entries"("ownerId");

-- CreateIndex
CREATE INDEX "pipeline_entries_clientId_idx" ON "pipeline_entries"("clientId");

-- CreateIndex
CREATE INDEX "pipeline_entries_leadId_idx" ON "pipeline_entries"("leadId");

-- CreateIndex
CREATE INDEX "pipeline_entries_expectedCloseAt_idx" ON "pipeline_entries"("expectedCloseAt");

-- CreateIndex
CREATE INDEX "stage_transitions_pipelineEntryId_idx" ON "stage_transitions"("pipelineEntryId");

-- CreateIndex
CREATE INDEX "stage_transitions_occurredAt_idx" ON "stage_transitions"("occurredAt");

-- CreateIndex
CREATE INDEX "field_visits_clientId_idx" ON "field_visits"("clientId");

-- CreateIndex
CREATE INDEX "field_visits_authorId_idx" ON "field_visits"("authorId");

-- CreateIndex
CREATE INDEX "field_visits_scheduledAt_idx" ON "field_visits"("scheduledAt");

-- CreateIndex
CREATE INDEX "sales_targets_ownerId_idx" ON "sales_targets"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_targets_ownerId_type_period_periodStart_key" ON "sales_targets"("ownerId", "type", "period", "periodStart");

-- AddForeignKey
ALTER TABLE "pipeline_entries" ADD CONSTRAINT "pipeline_entries_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_entries" ADD CONSTRAINT "pipeline_entries_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_entries" ADD CONSTRAINT "pipeline_entries_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_pipelineEntryId_fkey" FOREIGN KEY ("pipelineEntryId") REFERENCES "pipeline_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_visits" ADD CONSTRAINT "field_visits_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_visits" ADD CONSTRAINT "field_visits_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
