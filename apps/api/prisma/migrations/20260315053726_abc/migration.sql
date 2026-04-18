DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'dashboard_branch_daily_counts_tenant_id_branch_id_metric_date_i'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'dashboard_branch_daily_counts_tenant_id_branch_id_metric_da_idx'
  ) THEN
    ALTER INDEX "dashboard_branch_daily_counts_tenant_id_branch_id_metric_date_i"
      RENAME TO "dashboard_branch_daily_counts_tenant_id_branch_id_metric_da_idx";
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'dashboard_branch_daily_counts_tenant_id_scope_key_metric_date_k'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'dashboard_branch_daily_counts_tenant_id_scope_key_metric_da_key'
  ) THEN
    ALTER INDEX "dashboard_branch_daily_counts_tenant_id_scope_key_metric_date_k"
      RENAME TO "dashboard_branch_daily_counts_tenant_id_scope_key_metric_da_key";
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'dashboard_branch_stage_status_counts_tenant_id_scope_key_stage_'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'dashboard_branch_stage_status_counts_tenant_id_scope_key_st_key'
  ) THEN
    ALTER INDEX "dashboard_branch_stage_status_counts_tenant_id_scope_key_stage_"
      RENAME TO "dashboard_branch_stage_status_counts_tenant_id_scope_key_st_key";
  END IF;
END
$$;
