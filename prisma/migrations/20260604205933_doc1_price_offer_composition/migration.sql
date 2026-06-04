-- CreateEnum
CREATE TYPE "QuoteSectionType" AS ENUM ('COVER', 'ABOUT', 'SCOPE_PRICING', 'PAYMENT', 'METHODOLOGY', 'TIMELINE', 'REQUIREMENTS_NOTES', 'THANKYOU', 'IMAGE_PAGE', 'CUSTOM_RICHTEXT');

-- CreateEnum
CREATE TYPE "QuoteSectionBinding" AS ENUM ('DATA_BOUND', 'UPLOADED_IMAGE', 'STATIC_CONTENT');

-- CreateEnum
CREATE TYPE "QuoteAssetKind" AS ENUM ('COVER_BACKGROUND', 'LOGO', 'FULL_PAGE_IMAGE', 'SIGNATURE');

-- CreateTable
CREATE TABLE "quote_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_template_sections" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sectionType" "QuoteSectionType" NOT NULL,
    "bindingType" "QuoteSectionBinding" NOT NULL DEFAULT 'DATA_BOUND',
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "assetId" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_assets" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "QuoteAssetKind" NOT NULL DEFAULT 'FULL_PAGE_IMAGE',
    "label" TEXT,
    "fileAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_profiles" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "legalName" TEXT NOT NULL,
    "legalNameAr" TEXT,
    "aboutText" TEXT,
    "aboutTextAr" TEXT,
    "services" JSONB,
    "accreditations" JSONB,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "addressAr" TEXT,
    "logoUrl" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "iban" TEXT,
    "swift" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_profile_history" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_profile_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quote_templates_isDefault_idx" ON "quote_templates"("isDefault");

-- CreateIndex
CREATE INDEX "quote_templates_departmentId_idx" ON "quote_templates"("departmentId");

-- CreateIndex
CREATE INDEX "quote_template_sections_templateId_idx" ON "quote_template_sections"("templateId");

-- CreateIndex
CREATE INDEX "company_profiles_isActive_idx" ON "company_profiles"("isActive");

-- CreateIndex
CREATE INDEX "company_profile_history_profileId_idx" ON "company_profile_history"("profileId");

-- AddForeignKey
ALTER TABLE "quote_templates" ADD CONSTRAINT "quote_templates_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_templates" ADD CONSTRAINT "quote_templates_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "quote_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_template_sections" ADD CONSTRAINT "quote_template_sections_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "quote_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_template_sections" ADD CONSTRAINT "quote_template_sections_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "quote_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_profile_history" ADD CONSTRAINT "company_profile_history_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
