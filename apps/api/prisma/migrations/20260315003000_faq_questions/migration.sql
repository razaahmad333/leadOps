CREATE TABLE "public"."faq_questions" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "asked_by_id" TEXT NOT NULL,
  "answered_by_id" TEXT,
  "question" TEXT NOT NULL,
  "answer" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "answered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "faq_questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "faq_questions_tenant_id_status_created_at_idx" ON "public"."faq_questions"("tenant_id", "status", "created_at");
CREATE INDEX "faq_questions_tenant_id_asked_by_id_created_at_idx" ON "public"."faq_questions"("tenant_id", "asked_by_id", "created_at");

ALTER TABLE "public"."faq_questions"
ADD CONSTRAINT "faq_questions_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."faq_questions"
ADD CONSTRAINT "faq_questions_asked_by_id_fkey"
FOREIGN KEY ("asked_by_id") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."faq_questions"
ADD CONSTRAINT "faq_questions_answered_by_id_fkey"
FOREIGN KEY ("answered_by_id") REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
