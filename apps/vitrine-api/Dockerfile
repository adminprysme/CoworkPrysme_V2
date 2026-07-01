# syntax=docker/dockerfile:1
# Build context: monorepo root.

FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.8.1 --activate
WORKDIR /app

FROM base AS prepare
RUN apk add --no-cache libc6-compat
COPY . .
RUN pnpm dlx turbo prune @coworkprysme/vitrine-api --docker

FROM base AS builder
RUN apk add --no-cache libc6-compat
COPY --from=prepare /app/out/json/ .
COPY --from=prepare /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=prepare /app/out/full/ .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@coworkprysme/vitrine-api
RUN pnpm deploy --filter=@coworkprysme/vitrine-api --prod /prod/vitrine-api

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8002
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /prod/vitrine-api /app
USER nestjs
EXPOSE 8002
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8002/health || exit 1
CMD ["node", "dist/main.js"]
