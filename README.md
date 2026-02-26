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

# 5) Set SINGLE_TENANT_ID in apps/api/.env from seed output

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
- Owner: `owner@local.test` / `Password123!`
- Staff: `staff@local.test` / `Password123!`

## Scripts
- `pnpm dev`: run API + worker + web
- `pnpm build`: build all packages via Turbo
- `pnpm lint`: lint all packages
- `pnpm typecheck`: typecheck all packages
- `pnpm db:generate`: prisma generate (API)
- `pnpm db:migrate`: prisma migrate dev (API)
- `pnpm db:seed`: seed local data (API)

## Verification Checklist
1. Login works for owner/staff users.
2. Tenant context works (`DEPLOYMENT_MODE=multi` + `x-tenant-id` header, or single-tenant env).
3. Create lead works and enforces `nextFollowUpAt`.
4. Created lead appears in staff Today follow-ups.
5. Owner dashboard counters load.
6. Worker starts and processes demo summary/reminder jobs.

## Notes
- WhatsApp integration is scaffolded only (non-goal for v1).
- Settings page is read-only placeholder backed by tenant config store.
