# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN pnpm --filter @leadops/shared build \
  && pnpm --filter @leadops/api prisma:generate \
  && pnpm --filter @leadops/api build \
  && pnpm --filter @leadops/api deploy --prod --legacy /out \
  && PRISMA_PNPM_DIR="$(basename "$(find node_modules/.pnpm -maxdepth 1 -type d -name '@prisma+client@*' | head -n1)")" \
  && mkdir -p "/out/node_modules/.pnpm/${PRISMA_PNPM_DIR}/node_modules/.prisma" \
  && cp -R "node_modules/.pnpm/${PRISMA_PNPM_DIR}/node_modules/.prisma/client" "/out/node_modules/.pnpm/${PRISMA_PNPM_DIR}/node_modules/.prisma/"

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV HOME=/home/app
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --create-home --home-dir /home/app app \
  && mkdir -p /home/app /app \
  && chown -R app:nodejs /home/app /app

COPY --from=build /out/ ./

USER app
EXPOSE 3000
CMD ["node", "dist/main.js"]
