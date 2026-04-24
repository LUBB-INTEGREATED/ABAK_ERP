-- CreateTable
CREATE TABLE "saved_reports" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "reportCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "scheduledCron" TEXT,
    "recipients" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_reports_ownerId_idx" ON "saved_reports"("ownerId");

-- CreateIndex
CREATE INDEX "saved_reports_reportCode_idx" ON "saved_reports"("reportCode");

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
