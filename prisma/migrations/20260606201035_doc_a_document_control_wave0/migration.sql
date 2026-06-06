-- CreateEnum
CREATE TYPE "DocumentEntityType" AS ENUM ('PROJECT', 'GOV_TX', 'QUOTE', 'CLIENT', 'LEAD', 'FINANCE');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('ARCHITECTURAL', 'STRUCTURAL', 'LICENSE', 'FINANCIAL', 'CONTRACT', 'OTHER');

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "entityType" "DocumentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_entityType_entityId_idx" ON "documents"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "file_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
