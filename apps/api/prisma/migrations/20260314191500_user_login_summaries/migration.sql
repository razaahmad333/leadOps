-- CreateTable
CREATE TABLE "user_login_summaries" (
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "first_logged_in_at" TIMESTAMP(3) NOT NULL,
    "last_logged_in_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_login_summaries_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "user_login_summaries_tenant_id_first_logged_in_at_idx"
ON "user_login_summaries"("tenant_id", "first_logged_in_at");

-- AddForeignKey
ALTER TABLE "user_login_summaries"
ADD CONSTRAINT "user_login_summaries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_login_summaries"
ADD CONSTRAINT "user_login_summaries_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
