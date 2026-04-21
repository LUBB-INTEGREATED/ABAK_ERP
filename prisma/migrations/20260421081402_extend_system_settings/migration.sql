-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "defaultValue" TEXT,
ADD COLUMN     "descriptionAr" TEXT,
ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "editableByRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "labelAr" TEXT,
ADD COLUMN     "labelEn" TEXT,
ADD COLUMN     "maxValue" DOUBLE PRECISION,
ADD COLUMN     "minValue" DOUBLE PRECISION,
ADD COLUMN     "updatedById" TEXT;

-- CreateTable
CREATE TABLE "setting_history" (
    "id" TEXT NOT NULL,
    "settingId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setting_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "setting_history_settingId_idx" ON "setting_history"("settingId");

-- CreateIndex
CREATE INDEX "setting_history_changedAt_idx" ON "setting_history"("changedAt");

-- AddForeignKey
ALTER TABLE "setting_history" ADD CONSTRAINT "setting_history_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "system_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
