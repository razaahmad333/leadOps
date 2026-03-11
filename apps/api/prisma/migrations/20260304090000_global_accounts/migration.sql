-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "account_id" TEXT;

-- Backfill accounts by collapsing existing users on phone first, then email.
WITH ranked_users AS (
    SELECT
        "id",
        COALESCE(NULLIF("phone", ''), LOWER("email")) AS "identity_key",
        LOWER("email") AS "email",
        "phone",
        "password_hash",
        "status",
        "created_at",
        "updated_at",
        ROW_NUMBER() OVER (
            PARTITION BY COALESCE(NULLIF("phone", ''), LOWER("email"))
            ORDER BY "updated_at" DESC, "created_at" DESC, "id" ASC
        ) AS "rank"
    FROM "users"
), grouped AS (
    SELECT
        "identity_key",
        MIN("id") AS "account_id",
        MAX("email") FILTER (WHERE "rank" = 1) AS "preferred_email",
        MAX("phone") FILTER (WHERE "rank" = 1) AS "phone",
        MAX("password_hash") FILTER (WHERE "rank" = 1) AS "password_hash",
        CASE
            WHEN BOOL_OR("status" = 'ACTIVE') THEN 'ACTIVE'::"UserStatus"
            ELSE 'INACTIVE'::"UserStatus"
        END AS "status",
        MIN("created_at") AS "created_at",
        MAX("updated_at") AS "updated_at"
    FROM ranked_users
    GROUP BY "identity_key"
), prepared AS (
    SELECT
        "account_id",
        "preferred_email",
        "phone",
        "password_hash",
        "status",
        "created_at",
        "updated_at",
        COUNT(*) OVER (PARTITION BY "preferred_email") AS "email_occurrences",
        ROW_NUMBER() OVER (
            PARTITION BY "preferred_email"
            ORDER BY "updated_at" DESC, "created_at" ASC, "account_id" ASC
        ) AS "email_rank"
    FROM grouped
)
INSERT INTO "accounts" (
    "id",
    "email",
    "phone",
    "password_hash",
    "status",
    "created_at",
    "updated_at"
)
SELECT
    "account_id",
    CASE
        WHEN "email_occurrences" = 1 OR "email_rank" = 1 THEN "preferred_email"
        ELSE CONCAT(
            SPLIT_PART("preferred_email", '@', 1),
            '+',
            SUBSTRING("account_id" FROM 1 FOR 8),
            '@',
            SPLIT_PART("preferred_email", '@', 2)
        )
    END AS "email",
    "phone",
    "password_hash",
    "status",
    "created_at",
    "updated_at"
FROM prepared;

-- Link every tenant membership to its account.
WITH grouped AS (
    SELECT
        COALESCE(NULLIF("phone", ''), LOWER("email")) AS "identity_key",
        MIN("id") AS "account_id"
    FROM "users"
    GROUP BY COALESCE(NULLIF("phone", ''), LOWER("email"))
)
UPDATE "users" AS "u"
SET "account_id" = grouped."account_id"
FROM grouped
WHERE COALESCE(NULLIF("u"."phone", ''), LOWER("u"."email")) = grouped."identity_key";

-- Enforce the new constraints.
ALTER TABLE "users" ALTER COLUMN "account_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_phone_key" ON "accounts"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_account_id_key" ON "users"("tenant_id", "account_id");

-- CreateIndex
CREATE INDEX "users_account_id_idx" ON "users"("account_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the legacy tenant-scoped password column after the backfill.
ALTER TABLE "users" DROP COLUMN "password_hash";
