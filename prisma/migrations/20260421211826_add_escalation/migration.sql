-- CreateTable
CREATE TABLE "escalation_rules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "level1DelayHours" DOUBLE PRECISION NOT NULL,
    "level2DelayHours" DOUBLE PRECISION NOT NULL,
    "level3DelayHours" DOUBLE PRECISION NOT NULL,
    "level1RecipientSelector" TEXT NOT NULL,
    "level2RecipientSelector" TEXT NOT NULL,
    "level3RecipientSelector" TEXT NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_instances" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentLevel" INTEGER NOT NULL DEFAULT 0,
    "lastEscalatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedReason" TEXT,

    CONSTRAINT "escalation_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escalation_rules_code_key" ON "escalation_rules"("code");

-- CreateIndex
CREATE INDEX "escalation_instances_resolvedAt_idx" ON "escalation_instances"("resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "escalation_instances_ruleId_resource_resourceId_key" ON "escalation_instances"("ruleId", "resource", "resourceId");

-- AddForeignKey
ALTER TABLE "escalation_instances" ADD CONSTRAINT "escalation_instances_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "escalation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
