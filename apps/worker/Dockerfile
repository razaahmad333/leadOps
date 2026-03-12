# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/worker apps/worker
COPY apps/api/prisma apps/api/prisma
COPY packages/shared packages/shared
RUN pnpm --filter @leadops/shared build \
  && pnpm --filter @leadops/api prisma:generate \
  && pnpm --filter @leadops/worker build

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /workspace

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs app

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build /workspace/apps/worker/dist ./apps/worker/dist
COPY --from=build /workspace/apps/worker/package.json ./apps/worker/package.json
COPY --from=build /workspace/packages/shared/dist ./packages/shared/dist
COPY --from=build /workspace/packages/shared/package.json ./packages/shared/package.json

USER app
CMD ["node", "apps/worker/dist/main.js"]
