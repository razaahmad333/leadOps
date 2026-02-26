# HikmahOne LeadOps Architecture

## Foundation Choice
This repo is initialized using the **official Turborepo example approach** (Nest + monorepo conventions), then extended for HikmahOne requirements. Research details and links are in `docs/FOUNDATION_RESEARCH.md`.

## Monorepo Layout
- `apps/api`: NestJS + Fastify REST API (`/v1`, Swagger on `/docs`)
- `apps/worker`: NestJS worker process for BullMQ queue consumers
- `apps/web`: React + Vite + Tailwind + shadcn-style UI
- `packages/shared`: shared TS contracts (zod schemas, enums, event/queue constants)
- `infra/docker-compose.yml`: Postgres + Redis local infrastructure

## Multi-Tenancy
Tenant context is resolved per request in `TenantMiddleware`:
- `DEPLOYMENT_MODE=single`: uses `SINGLE_TENANT_ID` (falls back to first tenant)
- `DEPLOYMENT_MODE=multi`: resolves by subdomain or `x-tenant-id`

Resolved context (`tenantId`, `tenantSlug`, `requestId`) is propagated via `AsyncLocalStorage` and used by all services.

## Domain Model Highlights
- `Tenant`, `TenantConfig`, `User`
- `Lead` with required `nextFollowUpAt` for active statuses
- `FollowUp` with escalation marker (`escalatedAt`)
- `LeadActivity` timeline
- `WebhookMessage` idempotency store (`provider + messageId` unique)

## Event-Driven Inside, REST Outside
Public API remains REST under `/v1`, but internal flows emit domain events:
- `lead.created`
- `status.changed`
- `followup.due`
- `report.delivered`

Queues:
- `leadops-reminders` (follow-up reminder jobs)
- `leadops-reports` (summary/report jobs)

API enqueues jobs; worker consumes and processes reminders/escalations/report placeholders.

## Integrations (Adapter-First)
- Inbound adapter interface in `apps/api/src/integrations/adapters/inbound`
- Outbound messaging interface in `apps/api/src/integrations/adapters/outbound`
- Implemented in v1: `WebsiteFormAdapter`
- Scaffolded (non-goal v1): WhatsApp inbound/outbound adapters

## Follow-Up Engine
- Active leads (`NEW`, `CONTACTED`, `QUALIFIED`, `PENDING`) must always have `nextFollowUpAt`
- Scheduling normalized to tenant business window + timezone (`TenantConfigService`)
- When a follow-up is completed and no next pending follow-up exists, a continuity follow-up is auto-generated
- Worker escalation placeholder marks missed follow-ups and logs owner-notification action

## Observability and Hygiene
- Structured request logging (`requestId`, `tenantId`, latency)
- Centralized error envelope with metadata
- `/health` and `/metrics` endpoints
- Public intake rate-limit guard scaffolding
- Swagger/OpenAPI at `/docs` with Bearer auth scheme
