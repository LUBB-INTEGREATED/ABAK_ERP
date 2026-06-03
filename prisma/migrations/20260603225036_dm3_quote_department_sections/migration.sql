-- CreateEnum
CREATE TYPE "QuoteSectionStatus" AS ENUM ('DRAFT', 'SUBMITTED_TO_LEAD');

-- CreateEnum
CREATE TYPE "DeptPricingModel" AS ENUM ('LUMP_SUM', 'PER_VISIT', 'PER_UNIT');

-- CreateEnum
CREATE TYPE "QuoteRequirementType" AS ENUM ('DOCUMENT', 'NOTE');

-- AlterTable
ALTER TABLE "quote_items" ADD COLUMN     "sectionId" TEXT;

-- CreateTable
CREATE TABLE "quote_department_sections" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "pricerId" TEXT,
    "scopeTextAr" TEXT,
    "scopeTextEn" TEXT,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "status" "QuoteSectionStatus" NOT NULL DEFAULT 'DRAFT',
    "pricingModel" "DeptPricingModel" NOT NULL DEFAULT 'LUMP_SUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_department_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_requirements" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "type" "QuoteRequirementType" NOT NULL DEFAULT 'NOTE',
    "text" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "dedupedFromIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quote_department_sections_quoteId_idx" ON "quote_department_sections"("quoteId");

-- CreateIndex
CREATE INDEX "quote_department_sections_departmentId_idx" ON "quote_department_sections"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_department_sections_quoteId_departmentId_key" ON "quote_department_sections"("quoteId", "departmentId");

-- CreateIndex
CREATE INDEX "quote_requirements_quoteId_idx" ON "quote_requirements"("quoteId");

-- CreateIndex
CREATE INDEX "quote_items_sectionId_idx" ON "quote_items"("sectionId");

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "quote_department_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_department_sections" ADD CONSTRAINT "quote_department_sections_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_department_sections" ADD CONSTRAINT "quote_department_sections_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requirements" ADD CONSTRAINT "quote_requirements_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
