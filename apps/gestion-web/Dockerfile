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
RUN pnpm dlx turbo prune @coworkprysme/gestion-web --docker

FROM base AS builder
RUN apk add --no-cache libc6-compat
COPY --from=prepare /app/out/json/ .
COPY --from=prepare /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=prepare /app/out/full/ .
RUN pnpm install --frozen-lockfile
ARG VITE_API_URL=http://localhost:8003
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm turbo run build --filter=@coworkprysme/gestion-web
RUN VITE_API_ORIGIN="$(node -e "console.log(new URL(process.argv[1]).origin)" "$VITE_API_URL")" && \
    sed "s|__VITE_API_ORIGIN__|${VITE_API_ORIGIN}|g" apps/gestion-web/nginx.conf > /tmp/nginx.conf

FROM nginx:1.27-alpine AS runner
COPY --from=builder /tmp/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/gestion-web/dist /usr/share/nginx/html
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3002/api/health || exit 1
