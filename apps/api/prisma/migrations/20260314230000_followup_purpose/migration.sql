ALTER TABLE "public"."follow_ups"
ADD COLUMN "purpose_key" TEXT,
ADD COLUMN "purpose_label_snapshot" TEXT;

UPDATE "public"."follow_ups"
SET
  "purpose_key" = 'general_followup',
  "purpose_label_snapshot" = 'General Follow-up'
WHERE "purpose_key" IS NULL;
