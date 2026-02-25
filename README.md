# HikmahOne LeadOps

Production-grade multi-tenant CRM monorepo for managing leads, follow-ups, and sales pipelines.

## Stack

| Layer      | Technology                                       |
|------------|--------------------------------------------------|
| Backend    | NestJS 11 + Fastify + TypeScript                 |
| Database   | PostgreSQL 16 via Prisma 6 (shared-schema MT)    |
| Queue      | Redis 7 + BullMQ                                 |
| Frontend   | React 18 + Vite + TypeScript + Tailwind CSS 3    |
| Validation | Zod (shared between API + frontend)              |
| Monorepo   | pnpm workspaces                                  |

## Prerequisites

- **Node.js** >= 20 (`node -v`)
- **pnpm** >= 10 (`pnpm -v`)
- **Docker** >= 24 + Docker Compose v2 (`docker compose version`)

## Quick Start

```bash
# 1. Install all dependencies
pnpm install

# 2. Start PostgreSQL + Redis
docker compose -f infra/docker-compose.yml up -d

# 3. Copy env files and fill in secrets
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 4. Run database migration
pnpm db:migrate

# 5. Seed local development data
pnpm db:seed
# The seed output will print the tenant UUID — copy it:
#   SINGLE_TENANT_ID=<uuid>  → paste into apps/api/.env
#   VITE_TENANT_ID=<uuid>    → paste into apps/web/.env

# 6. Start all apps (API + Web concurrently)
pnpm dev
```

## Apps

| App              | URL                          | Description            |
|------------------|------------------------------|------------------------|
| `@leadops/api`   | http://localhost:3000        | NestJS REST API        |
| `@leadops/web`   | http://localhost:5173        | React frontend         |
| Swagger / OpenAPI | http://localhost:3000/docs  | Interactive API docs   |
| Health check     | http://localhost:3000/health | No-auth health endpoint|

## Packages

| Package          | Description                                    |
|------------------|------------------------------------------------|
| `@leadops/shared` | Zod schemas + TypeScript types (API + web)   |
| `@leadops/config` | ESLint + tsconfig presets                     |

## Local Dev Credentials

| Role  | Email                | Password      |
|-------|----------------------|---------------|
| Owner | owner@local.test     | Password123!  |
| Staff | staff@local.test     | Password123!  |

## Root Scripts

| Script            | Description                              |
|-------------------|------------------------------------------|
| `pnpm dev`        | Run API + web concurrently               |
| `pnpm build`      | Build all packages                       |
| `pnpm lint`       | Lint all packages                        |
| `pnpm typecheck`  | Type-check all packages                  |
| `pnpm test`       | Run tests                                |
| `pnpm db:migrate` | Run Prisma migrations (dev)              |
| `pnpm db:seed`    | Seed local development data              |
| `pnpm db:studio`  | Open Prisma Studio (DB GUI)              |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for multi-tenancy design, adapter pattern, and deployment modes.

## API Reference

See Swagger UI at http://localhost:3000/docs after starting the API.

### Quick curl test

```bash
# Health (no auth)
curl http://localhost:3000/health

# Login (add x-tenant-id header if DEPLOYMENT_MODE=multi)
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@local.test","password":"Password123!"}'
```
