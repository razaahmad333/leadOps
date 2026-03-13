# HikmahOne LeadOps Architecture

## Foundation Choice
This repo starts from official Turborepo + Nest monorepo conventions, then layers domain logic for LeadOps. Source comparison and rationale are in `docs/FOUNDATION_RESEARCH.md`.

## Monorepo Layout
- `apps/api`: NestJS + Fastify API (`/v1`) + Swagger (`/docs`) + Socket.IO (`/realtime`)
- `apps/worker`: NestJS worker application context for BullMQ processors
- `apps/web`: React + Vite frontend
- `packages/shared`: cross-app contracts (Zod schemas, enums, queue/realtime constants)
- `infra/docker-compose.yml`: local Postgres + Redis

## Runtime Boundaries
- API process handles auth, tenant-scoped business operations, queue enqueueing, and realtime fanout.
- Worker process handles delayed queue execution (`leadops-reminders`, `leadops-reports`).
- Redis is used for BullMQ and worker-to-API realtime pub/sub (`leadops:realtime:events`).

## Multi-Tenancy and Request Context
Tenant context is resolved by `TenantMiddleware` and propagated through `AsyncLocalStorage`:
- `DEPLOYMENT_MODE=single`: fixed by `SINGLE_TENANT_ID` (fallback to first tenant).
- `DEPLOYMENT_MODE=multi`: subdomain, `x-tenant-id`, or tenant ID from bearer token.
- If no explicit tenant signal in multi mode, request runs in `system` context (used by global auth flows).

Global auth routes (`/v1/auth/login`, forgot-password OTP, `/v1/auth/select-tenant`) bypass tenant resolution and run in system context.

## Auth, RBAC, and Branch Scope
- Authentication is account-level (email or phone), then membership-level tenant session issuance.
- Multi-membership users receive a tenant-selection challenge before tenant-scoped access token issuance.
- Permission evaluation is role-based (`permission`, `permission_role`, `user_role`) with legacy role compatibility.
- Branch visibility is enforced via `BranchScopeService`:
  - all branches for tenant admin/superadmin (or `ALL_BRANCHES`)
  - filtered branch IDs for `SELECTED` scope users

## Domain Model Highlights
- `Tenant`, `TenantConfig`, `TenantAuditEvent`
- `Account` (shared identity), `User` (tenant membership)
- `Permission`, `PermissionRole`, `RolePermission`, `UserRole`
- `Branch`, `UserBranchScope`
- `Lead`, `FollowUp`, `LeadActivity`
- `WebhookMessage` (provider/message idempotency)

## API Surface (v1)
Main tenant APIs:
- `auth`, `tenant`, `dashboard`, `leads`, `followups`
- `users`, `roles`, `permissions`, `branches`, `settings`, `settings/intake-config`

Platform APIs (superadmin):
- paginated tenant listing and lightweight tenant options
- tenant details drawer payload (tenant/users/branches/settings/audit, with optional users/audit pagination)
- tenant settings updates
- cross-tenant branch management
- cross-tenant role management
- cross-tenant user updates and password reset

## Follow-Up and Queue Semantics
- Active lead statuses (`NEW`, `CONTACTED`, `QUALIFIED`, `PENDING`) require `nextFollowUpAt`.
- Lead creation creates initial pending `GENERAL` follow-up and schedules `followup-<id>` reminder job.
- Status update sync behavior:
  - active + `nextFollowUpAt` provided: reschedule earliest pending `GENERAL`, or auto-create if none
  - closed (`WON`/`LOST`): clear `lead.nextFollowUpAt`, auto-complete all pending follow-ups, cancel reminder jobs
- Mark done:
  - sets follow-up done/doneAt
  - cancels reminder job
  - may auto-create continuity follow-up for active leads if no pending follow-up remains
- Today queue supports tenant/branch scope, search, pagination, and optional overdue inclusion.

## Realtime Model (Socket.IO + Redis)
- Gateway namespace: `/realtime`
- Handshake auth: JWT access token
- Room model:
  - `tenant:{tenantId}`
  - `tenant:{tenantId}:branch:{branchId}`
  - `lead:{leadId}`
- Client commands:
  - `realtime.branch.set`
  - `realtime.lead.subscribe`
  - `realtime.lead.unsubscribe`
- Server event:
  - `realtime.invalidation` with compact invalidation envelope
- Sources:
  - API publishes invalidations after successful writes
  - Worker publishes due/escalation invalidations to Redis; API bridge rebroadcasts

## Integrations
- Public website intake: `POST /v1/intake/website` (rate-limited, idempotent by provider message id)
- Adapter-first structure is in place for inbound/outbound channels.
- WhatsApp public webhook/outbound delivery remains scaffolded in v1.

## Observability and Operational Hygiene
- Structured request logging with `requestId` and tenant context.
- Consistent error envelope via global exception filter.
- Health and metrics endpoints: `/health`, `/metrics`.
- Swagger/OpenAPI available at `/docs` with bearer auth support.
