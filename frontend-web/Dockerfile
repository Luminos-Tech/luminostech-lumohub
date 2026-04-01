# Build trên máy local trước (tránh lỗi mạng trong Docker):
#   npm run build
# Sau đó build Docker không cần npm install:
#   docker build -t lumohub-frontend --target production .

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

# builder chỉ cần build source, không cần deps (đã có .next từ local)
FROM node:20-alpine AS builder
WORKDIR /app
ARG INTERNAL_API_URL=http://127.0.0.1:8000
ENV INTERNAL_API_URL=$INTERNAL_API_URL
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps
RUN npm run build

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
