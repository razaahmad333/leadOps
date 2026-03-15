# Follow-Up Query Scaling

## Goal
Keep branch-scoped follow-up reads normalized for now, harden them with selective indexes, and measure their real cost before deciding whether `follow_ups.branch_id` needs to be denormalized.

## Index Hardening
The current hardening step adds:

- `leads(tenant_id, branch_id, id)`
- `follow_ups(tenant_id, lead_id, done, scheduled_at)`

This keeps the existing join model but gives PostgreSQL better access paths for:

- branch-scoped due queue lists
- branch-scoped pending and overdue counts
- dashboard follow-up health counts

## Baseline Runner
Use the API package script to capture representative `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plans for the current join-based follow-up queries.

Command:

```bash
pnpm --filter @leadops/api perf:followups
```

Required environment variables:

- `DATABASE_URL`
- `PERF_TENANT_ID`
- `PERF_BRANCH_ID`

Optional environment variables:

- `PERF_REPEAT` default `5`
- `PERF_LIMIT` default `20`
- `PERF_OFFSET` default `0`
- `PERF_START_AT` ISO timestamp for the start of the business day window
- `PERF_END_AT` ISO timestamp for the end of the business day window
- `PERF_NOW_AT` ISO timestamp for overdue comparisons

The runner reports:

- root plan node
- planning time
- average execution time
- p95 execution time
- average rows visited across plan nodes

## What To Baseline
Run the baseline before and after the new indexes are applied for a large tenant:

- due queue list with branch scope
- pending follow-up count by branch
- missed/overdue follow-up count by branch
- dashboard follow-up health query by branch

Keep the same tenant, branch, date window, and repeat count for before/after comparisons.

## Cutover Criteria For Denormalization
Stay on the normalized join model unless branch-scoped follow-up reads still show poor plans or unacceptable latency after index hardening.

Denormalize `branch_id` onto `follow_ups` if one or more of these remain true on representative tenant data:

- branch-scoped pending/overdue counts remain scan-heavy
- due queue list latency remains above acceptable p95 under expected concurrency
- dashboard follow-up health counts remain materially slower than lead-scoped metrics
- planner keeps choosing wide join paths even after warm-cache and cold-cache tests

## Denormalization Next Step
If cutover is needed:

1. Add nullable `follow_ups.branch_id`
2. Backfill from `leads.branch_id` in batches
3. Populate `branch_id` on new follow-up writes
4. Add direct indexes such as:
   - `follow_ups(tenant_id, branch_id, done, scheduled_at)`
   - optionally `follow_ups(tenant_id, branch_id, done, done_at)`
5. Switch hot branch-scoped follow-up reads from join filtering to direct branch filtering
6. Compare join-based counts and direct-branch counts during rollout until parity is confirmed

## Production Rollout Note
The Prisma migration in this repo adds the indexes in the normal migration flow. For very large production tables, prefer the least-locking index creation method supported by PostgreSQL rollout policy, such as an operational `CREATE INDEX CONCURRENTLY` change window if needed.
