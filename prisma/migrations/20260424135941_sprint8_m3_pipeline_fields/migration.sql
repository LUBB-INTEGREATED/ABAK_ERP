-- AlterTable
ALTER TABLE "pipeline_entries" ADD COLUMN     "decisionMakerContact" TEXT,
ADD COLUMN     "decisionMakerName" TEXT,
ADD COLUMN     "expectedDecisionDate" TIMESTAMP(3),
ADD COLUMN     "isStuck" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextStepDueDate" TIMESTAMP(3),
ADD COLUMN     "stuckSince" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "pipeline_entries_isStuck_idx" ON "pipeline_entries"("isStuck");
