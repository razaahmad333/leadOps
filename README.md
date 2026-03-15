# HikmahOne LeadOps

Production-grade LeadOps platform for multi-tenant teams.

## Stack
- Monorepo: `pnpm workspaces` + `Turborepo`
- API: NestJS + Fastify + Swagger/OpenAPI + Socket.IO gateway
- Worker: NestJS queue worker (BullMQ + Redis)
- Web: React + Vite + Tailwind + shadcn-style components + lucide icons
- Shared contracts: `@leadops/shared` (Zod schemas + enums + queue/realtime constants)
- Persistence: Prisma + PostgreSQL
- Realtime bridge: Redis pub/sub (`leadops:realtime:events`)

## Repository Structure
- `apps/api`
- `apps/worker`
- `apps/web`
- `packages/shared`
- `infra/docker-compose.yml`
- `docs/ARCHITECTURE.md`
- `docs/FOUNDATION_RESEARCH.md`
- `docs/INGESTIONS.md`
- `docs/USER_MANUAL.md`

## Local Setup
```bash
# 1) Start infra
docker compose -f infra/docker-compose.yml up -d

# 2) Install dependencies
pnpm install

# 3) Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/web/.env.example apps/web/.env

# 4) Generate Prisma client + migrate + seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5) Choose tenant resolution mode in apps/api/.env
# Option A (single tenant): DEPLOYMENT_MODE=single + SINGLE_TENANT_ID=<tenant-id>
# Option B (shared SaaS): DEPLOYMENT_MODE=multi

# 6) Run all apps
pnpm dev
```

Run services separately (optional):
```bash
pnpm --filter @leadops/api dev
pnpm --filter @leadops/worker dev
pnpm --filter @leadops/web dev
```

## URLs
- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- Health: `http://localhost:3000/health`
- Metrics: `http://localhost:3000/metrics`
- Realtime namespace (Socket.IO): `http://localhost:3000/realtime`

## Local Credentials
- SUPER_ADMIN (Demo Lab membership): `admin@local.test` or `+1-555-0001` / `Password123!`
- Shared OWNER (Demo Lab + Demo Generic): `owner@local.test` or `+1-555-0101` / `Password123!`
- Shared STAFF (Demo Lab + Demo Generic): `staff@local.test` or `+1-555-0102` / `Password123!`

Note for shared OWNER/STAFF: login returns tenant selection (`tenant_selection_required`) because those accounts have multiple memberships.

## Platform Admin (`/platform/admin`)
Sign in as `admin@local.test` (superadmin) to:
- view paginated tenant table with search/sort
- open tenant detail drawer with tabs: Tenant, Users, Branches, Settings, Roles, Audit
- create tenants and create additional tenant memberships
- manage tenant settings (timezone, business window, reminder rules)
- create/edit/activate/deactivate tenant branches
- create/edit tenant roles (system roles are read-only)
- update user details, role assignments, branch scope/default branch, and reset passwords

## User Manual
- Product operating guide: `docs/USER_MANUAL.md`
- In-app manual: open the manual from the left navigation to see module summaries for the routes your account can access

## Scripts
- `pnpm dev`: run API + worker + web
- `pnpm build`: build all packages via Turbo
- `pnpm lint`: lint all packages
- `pnpm typecheck`: typecheck all packages
- `pnpm test`: run package tests
- `pnpm db:generate`: Prisma generate (API)
- `pnpm db:migrate`: Prisma migrate dev (API)
- `pnpm db:seed`: seed local data (API)
- `pnpm db:studio`: Prisma Studio (API)

## Verification Checklist
1. Log in with `owner@local.test`; verify tenant selection appears (Demo Lab / Demo Generic).
2. Open Dashboard: verify the cards and charts follow the selected branch scope and `Follow-up Health` shows `Overdue`, `Escalated`, `Due Today`, and `Completed Today`.
3. In single-branch scope, verify `Source Mix` renders as a pie chart; in multi-branch scope, verify the comparison chart switches to branch comparison.
4. Open Leads: search, stage filter, branch filter (if multi-branch), and pagination work server-side.
5. Create a lead without `ownerId`; verify the backend resolves a lead owner and the initial follow-up gets an assignee.
6. Create a lead with `nextFollowUpAt`; verify reminder, first escalation, and second escalation jobs are created.
7. Open the Due Queue and verify the status filter works for `All due`, `Due today`, `Overdue`, and `Escalated`.
8. Trigger escalation and verify escalated rows show badges, second-level escalations show `L2`, and escalated work sorts first.
9. Open the notification bell; verify reminder and escalation notifications appear, unread count updates, and mark-read actions work.
10. Update lead status with `nextFollowUpAt`; verify lead + follow-up schedule stay in sync.
11. Mark a follow-up done from Today; verify reminder/escalation job cancellation and continuity behavior for active leads.
12. Change stage to report-delivered milestone; verify post-report follow-up is scheduled from tenant rules.
13. Open two browser sessions; verify realtime invalidation refreshes Leads/Today after write actions.

## Notes
- WhatsApp inbound/outbound adapters remain scaffolded in v1; public webhook is not exposed yet.
- Tenant reminder/business-window settings are editable via `PATCH /v1/settings` for tenant admin or superadmin with `settings.manage`.
- Ingestion examples (`curl` + script patterns) are in `docs/INGESTIONS.md`.
