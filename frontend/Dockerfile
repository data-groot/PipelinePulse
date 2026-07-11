# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# BACKEND_URL is only read at runtime by the rewrite proxy, so no build args needed
RUN npm run build

# Run stage — Next.js standalone output
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Cloud Run injects PORT (default 8080)
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
