-- CreateTable
CREATE TABLE "tenant_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "business_start" TEXT NOT NULL DEFAULT '09:00',
    "business_end" TEXT NOT NULL DEFAULT '18:00',
    "stages" JSONB NOT NULL,
    "reminder_rules" JSONB NOT NULL,
    "templates" JSONB NOT NULL,
    "feature_flags" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_configs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "leads"
ADD COLUMN "owner_id" TEXT,
ADD COLUMN "next_follow_up_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "follow_ups"
ADD COLUMN "done_at" TIMESTAMP(3),
ADD COLUMN "escalated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "provider" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "payload_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "webhook_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_configs_tenant_id_key" ON "tenant_configs"("tenant_id");

-- CreateIndex
CREATE INDEX "leads_tenant_id_status_idx" ON "leads"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "leads_tenant_id_next_follow_up_at_idx" ON "leads"("tenant_id", "next_follow_up_at");

-- CreateIndex
CREATE INDEX "follow_ups_tenant_id_done_scheduled_at_idx" ON "follow_ups"("tenant_id", "done", "scheduled_at");

-- CreateIndex
CREATE INDEX "lead_activities_tenant_id_lead_id_created_at_idx" ON "lead_activities"("tenant_id", "lead_id", "created_at");

-- CreateIndex
CREATE INDEX "webhook_messages_tenant_id_provider_idx" ON "webhook_messages"("tenant_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_messages_provider_message_id_key" ON "webhook_messages"("provider", "message_id");

-- AddForeignKey
ALTER TABLE "tenant_configs"
ADD CONSTRAINT "tenant_configs_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads"
ADD CONSTRAINT "leads_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities"
ADD CONSTRAINT "lead_activities_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities"
ADD CONSTRAINT "lead_activities_lead_id_fkey"
FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities"
ADD CONSTRAINT "lead_activities_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_messages"
ADD CONSTRAINT "webhook_messages_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
