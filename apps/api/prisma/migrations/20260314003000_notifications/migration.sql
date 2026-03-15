-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "lead_id" TEXT NOT NULL,
    "follow_up_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_follow_up_id_type_key"
ON "notifications"("follow_up_id", "type");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_user_id_read_at_created_at_idx"
ON "notifications"("tenant_id", "user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_follow_up_id_idx"
ON "notifications"("follow_up_id");

-- AddForeignKey
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_branch_id_fkey"
FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_lead_id_fkey"
FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_follow_up_id_fkey"
FOREIGN KEY ("follow_up_id") REFERENCES "follow_ups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
