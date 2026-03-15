-- CreateIndex
CREATE INDEX "leads_tenant_id_branch_id_id_idx"
ON "leads"("tenant_id", "branch_id", "id");

-- CreateIndex
CREATE INDEX "follow_ups_tenant_id_lead_id_done_scheduled_at_idx"
ON "follow_ups"("tenant_id", "lead_id", "done", "scheduled_at");
