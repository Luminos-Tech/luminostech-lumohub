# syntax=docker/dockerfile:1.4
# ─────────────────────────────────────────────────────────────────────────────
# LUMO Hub — Frontend Web production Dockerfile
# ─────────────────────────────────────────────────────────────────────────────
#
# Build trên máy local trước (tránh lỗi mạng trong Docker):
#   npm run build
# Sau đó build Docker không cần npm install:
#   DOCKER_BUILDKIT=1 docker build -t lumohub-frontend --target production .
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# BuildKit cache mount: persist npm cache giữa các lần build → lần 2 cực nhanh
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --prefer-offline --no-audit --no-fund

# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --prefer-offline --no-audit --no-fund
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT=3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
