-- AlterTable
ALTER TABLE "tenant_configs"
ADD COLUMN "industry_preset" TEXT NOT NULL DEFAULT 'GENERIC',
ADD COLUMN "config_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "display_config" JSONB;

-- AlterTable
ALTER TABLE "leads"
ADD COLUMN "stage_key" TEXT,
ADD COLUMN "intake_data" JSONB;

-- AlterTable
ALTER TABLE "follow_ups"
ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE INDEX "leads_tenant_id_stage_key_idx" ON "leads"("tenant_id", "stage_key");
