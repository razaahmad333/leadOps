ALTER TABLE "public"."faq_questions"
ADD COLUMN "branch_id" TEXT;

CREATE INDEX "faq_questions_tenant_id_branch_id_created_at_idx"
ON "public"."faq_questions"("tenant_id", "branch_id", "created_at");

ALTER TABLE "public"."faq_questions"
ADD CONSTRAINT "faq_questions_branch_id_fkey"
FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
