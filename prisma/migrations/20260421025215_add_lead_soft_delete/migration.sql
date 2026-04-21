-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "leads_deletedAt_idx" ON "leads"("deletedAt");
