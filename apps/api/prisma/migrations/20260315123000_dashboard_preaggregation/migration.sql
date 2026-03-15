CREATE TABLE "dashboard_branch_metrics" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "scope_key" TEXT NOT NULL,
  "new_count" INTEGER NOT NULL DEFAULT 0,
  "pending_count" INTEGER NOT NULL DEFAULT 0,
  "won_count" INTEGER NOT NULL DEFAULT 0,
  "lost_count" INTEGER NOT NULL DEFAULT 0,
  "active_count" INTEGER NOT NULL DEFAULT 0,
  "pending_followups" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dashboard_branch_metrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dashboard_branch_stage_status_counts" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "scope_key" TEXT NOT NULL,
  "stage_key" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dashboard_branch_stage_status_counts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dashboard_branch_source_counts" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "scope_key" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dashboard_branch_source_counts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dashboard_branch_daily_counts" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "scope_key" TEXT NOT NULL,
  "metric_date" DATE NOT NULL,
  "leads_created" INTEGER NOT NULL DEFAULT 0,
  "bookings_marked" INTEGER NOT NULL DEFAULT 0,
  "followups_completed" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dashboard_branch_daily_counts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dashboard_projection_state" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "scope_key" TEXT NOT NULL,
  "refreshed_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dashboard_projection_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dashboard_branch_metrics_tenant_id_scope_key_key"
ON "dashboard_branch_metrics"("tenant_id", "scope_key");

CREATE INDEX "dashboard_branch_metrics_tenant_id_branch_id_idx"
ON "dashboard_branch_metrics"("tenant_id", "branch_id");

CREATE UNIQUE INDEX "dashboard_branch_stage_status_counts_tenant_id_scope_key_stage_key_status_key"
ON "dashboard_branch_stage_status_counts"("tenant_id", "scope_key", "stage_key", "status");

CREATE INDEX "dashboard_branch_stage_status_counts_tenant_id_branch_id_idx"
ON "dashboard_branch_stage_status_counts"("tenant_id", "branch_id");

CREATE UNIQUE INDEX "dashboard_branch_source_counts_tenant_id_scope_key_source_key"
ON "dashboard_branch_source_counts"("tenant_id", "scope_key", "source");

CREATE INDEX "dashboard_branch_source_counts_tenant_id_branch_id_idx"
ON "dashboard_branch_source_counts"("tenant_id", "branch_id");

CREATE UNIQUE INDEX "dashboard_branch_daily_counts_tenant_id_scope_key_metric_date_key"
ON "dashboard_branch_daily_counts"("tenant_id", "scope_key", "metric_date");

CREATE INDEX "dashboard_branch_daily_counts_tenant_id_branch_id_metric_date_idx"
ON "dashboard_branch_daily_counts"("tenant_id", "branch_id", "metric_date");

CREATE UNIQUE INDEX "dashboard_projection_state_tenant_id_scope_key_key"
ON "dashboard_projection_state"("tenant_id", "scope_key");

CREATE INDEX "dashboard_projection_state_tenant_id_branch_id_refreshed_at_idx"
ON "dashboard_projection_state"("tenant_id", "branch_id", "refreshed_at");

ALTER TABLE "dashboard_branch_metrics"
ADD CONSTRAINT "dashboard_branch_metrics_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dashboard_branch_stage_status_counts"
ADD CONSTRAINT "dashboard_branch_stage_status_counts_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dashboard_branch_source_counts"
ADD CONSTRAINT "dashboard_branch_source_counts_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dashboard_branch_daily_counts"
ADD CONSTRAINT "dashboard_branch_daily_counts_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dashboard_projection_state"
ADD CONSTRAINT "dashboard_projection_state_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
