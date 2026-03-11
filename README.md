# HikmahOne LeadOps

Production-grade LeadOps platform for multi-tenant teams.

## Stack
- Monorepo: `pnpm workspaces` + `Turborepo`
- API: NestJS + Fastify + Swagger/OpenAPI
- Worker: NestJS queue worker (BullMQ + Redis)
- Web: React + Vite + Tailwind + shadcn-style components + lucide icons
- Persistence: Prisma + PostgreSQL

## Repository Structure
- `apps/api`
- `apps/worker`
- `apps/web`
- `packages/shared`
- `infra/docker-compose.yml`
- `docs/ARCHITECTURE.md`
- `docs/FOUNDATION_RESEARCH.md`
- `docs/INGESTIONS.md`

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

# 5) Choose tenant resolution mode
# Option A (single tenant / dedicated): set DEPLOYMENT_MODE=single + SINGLE_TENANT_ID=<seeded tenant id> in apps/api/.env
# Option B (shared multi-tenant SaaS): set DEPLOYMENT_MODE=multi in apps/api/.env

# 6) Run everything (api + worker + web)
pnpm dev
```

## URLs
- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- Health: `http://localhost:3000/health`
- Metrics: `http://localhost:3000/metrics`

## Local Credentials
- Shared OWNER (Demo Lab + Demo Generic): `owner@local.test` or `+1-555-0101` / `Password123!`
- Shared STAFF (Demo Lab + Demo Generic): `staff@local.test` or `+1-555-0102` / `Password123!`
- SUPER_ADMIN (Demo Lab membership): `admin@local.test` or `+1-555-0001` / `Password123!`

## Platform Admin
- Sign in as `admin@local.test` and open `/platform/admin`
- Use it to create tenants, seed the first tenant admin, and grant additional tenant access to existing or new accounts

## Scripts
- `pnpm dev`: run API + worker + web
- `pnpm build`: build all packages via Turbo
- `pnpm lint`: lint all packages
- `pnpm typecheck`: typecheck all packages
- `pnpm db:generate`: prisma generate (API)
- `pnpm db:migrate`: prisma migrate dev (API)
- `pnpm db:seed`: seed local data (API)

## Verification Checklist
1. Login as Demo Lab staff: labels show Enquiries/Bookings/Reports and lab workflow vocabulary.
2. Demo Lab intake form shows lab fields: `testOrPackage`, `homeCollection`, `preferredSlot`, `pincode`, `source`.
3. Dashboard cards switch for Demo Lab (`Enquiries Today`, `Bookings Today`, `Post-Report Follow-ups Due`, etc.).
4. Login as Demo Generic: UI remains generic LeadOps labels and generic intake fields.
5. Create lead/enquiry works and enforces `nextFollowUpAt`.
6. Tenant context works via `GET /v1/tenant/me` in both `DEPLOYMENT_MODE=multi` (token or tenant slug driven) and `DEPLOYMENT_MODE=single`.
7. Change stage to `REPORT_DELIVERED`: post-report follow-up task is created/scheduled from tenant config rules.
8. Worker starts and processes reminder jobs.

## Notes
- WhatsApp integration is scaffolded only (non-goal for v1).
- Settings page is read-only placeholder backed by tenant config (`/v1/tenant/me` + `/v1/settings`).
- Ingestion examples (`curl` + scripts) are documented in `docs/INGESTIONS.md`.
