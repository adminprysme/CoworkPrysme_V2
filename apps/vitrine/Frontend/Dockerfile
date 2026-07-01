# syntax=docker/dockerfile:1
# Build context: monorepo root (required for workspace packages).
# Coolify: Dockerfile path = apps/vitrine/Frontend/Dockerfile, context = .

FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.8.1 --activate
WORKDIR /app

FROM base AS prepare
RUN apk add --no-cache libc6-compat
COPY . .
RUN pnpm dlx turbo prune @coworkprysme/vitrine-web --docker

FROM base AS builder
RUN apk add --no-cache libc6-compat
COPY --from=prepare /app/out/json/ .
COPY --from=prepare /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=prepare /app/out/full/ .
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3001
ARG NEXT_PUBLIC_API_URL=http://localhost:8002
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=@coworkprysme/vitrine-web

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
# Runtime — override in Coolify (instrumentation fail-fast if missing)
ENV NEXT_PUBLIC_SITE_URL=
ENV NEXT_PUBLIC_API_URL=
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/vitrine/Frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/vitrine/Frontend/.next/static ./apps/vitrine/Frontend/.next/static
USER nextjs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["node", "apps/vitrine/Frontend/server.js"]
