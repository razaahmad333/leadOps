# Architecture — HikmahOne LeadOps

## Overview

HikmahOne LeadOps is a multi-tenant CRM built as a pnpm monorepo. The goal is a single codebase that can run as:

1. **Shared SaaS** — multiple tenants on one deployment, separated by `tenantId`
2. **Dedicated single-tenant** — one tenant, one deployment (`DEPLOYMENT_MODE=single`)
3. **On-premises** — same binary, customer-owned infrastructure

---

## Core Workflow Engine

The platform is built around a simple pipeline:

```
Lead enters → Contact → Qualify → Follow-up loop → Won / Lost
```

Everything else (reminders, notifications, integrations) is an **adapter** that hooks into this pipeline.

---

## Multi-Tenancy Design

### Strategy: Shared Schema

All tenants share a single PostgreSQL database. Every table has a `tenantId` column. All queries are automatically filtered to the current tenant.

**Why not separate schemas or databases per tenant?**
- Shared schema is simpler to operate, migrate, and monitor at startup scale
- It can be replaced later if a customer requires isolation — the adapter pattern makes this feasible

### Tenant Resolution Flow

```
Incoming HTTP request
        │
        ▼
  TenantMiddleware
        │
        ├─ DEPLOYMENT_MODE=single? ──► use SINGLE_TENANT_ID env var
        │
        ├─ subdomain? (e.g. acme.leadops.com) ──► slug lookup
        │
        └─ x-tenant-id header? ──► UUID lookup (dev-friendly)
                │
                ▼
        tenantStorage.run({ tenantId }, next)
                │
                ▼
   All services call getTenantContext() from AsyncLocalStorage
```

### Why AsyncLocalStorage?

NestJS's `REQUEST`-scoped providers cascade their scope to every provider that injects them. A single request-scoped `TenantContext` would force **all dependent services** to become request-scoped — including services that themselves depend on other services. This has measurable performance overhead at scale.

`AsyncLocalStorage` sidesteps this: the tenant context is stored in Node.js's native continuation-local storage, accessible from any singleton service via `getTenantContext()` without injecting anything request-scoped.

---

## Authentication

- **JWT HS256** symmetric key (single shared secret)
- Access token: 7-day expiry (configurable via `JWT_EXPIRES_IN`)
- Refresh token: stub endpoint (not yet implemented)
- Guards:
  - `JwtAuthGuard` — validates Bearer token, attaches `user` to request
  - `RolesGuard` — checks `@Roles(Role.OWNER)` decorator against `user.role`

---

## Adapter Pattern (Future)

The platform is designed to receive leads and send follow-up notifications through multiple channels:

```
                    ┌──────────────────────────────┐
                    │     Core Workflow Engine      │
                    │  (Leads, FollowUps, Users)    │
                    └───────────┬──────────────────-┘
                                │
          ┌─────────────────────┼──────────────────────────┐
          ▼                     ▼                          ▼
   Website Widget          WhatsApp API              Phone / Calls
   (leads from forms)  (leads + notifications)    (click-to-call)
```

Each channel is an **adapter** that:
1. Creates leads via the internal `LeadsService`
2. Listens for follow-up events via the queue (`BullMQ`)
3. Sends notifications via its own channel-specific transport

Adapters are not implemented yet but the queue infrastructure (`ping-queue`, `reminder.worker.ts`) provides the scaffolding.

---

## Queue Layer

- **Technology**: Redis + BullMQ (`@nestjs/bullmq`)
- **Current queues**: `ping-queue` (demo/health check)
- **Planned**: `reminder-queue` for scheduled follow-up notifications

The `ReminderWorker` in `apps/api/src/queue/reminder.worker.ts` is a placeholder that documents the intended implementation.

---

## Deployment Modes

| Mode | Config | Description |
|------|--------|-------------|
| `multi` (default) | `DEPLOYMENT_MODE=multi` | SaaS — tenant from subdomain or header |
| `single` | `DEPLOYMENT_MODE=single` + `SINGLE_TENANT_ID=<uuid>` | Dedicated — one tenant, no header needed |

On-premises deployment uses `single` mode with customer-managed infrastructure (Docker Compose or Kubernetes).

---

## Package Dependency Graph

```
@leadops/api ──────────────► @leadops/shared (Zod schemas + types)
@leadops/web ──────────────► @leadops/shared
@leadops/shared ───────────► zod
@leadops/config ───────────► (devDependencies only — no runtime deps)
```

Both `@leadops/api` and `@leadops/web` import `@leadops/shared` directly from TypeScript source (via `paths` alias), so no build step is needed for the shared package during development.
