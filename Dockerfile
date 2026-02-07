# ============================================
# Stage 1: Build (install all deps + build frontend)
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

RUN echo "=== Building frontend ===" && \
    npm run build && \
    echo "=== Verifying build output ===" && \
    ls -la dist/public/ && \
    test -f dist/public/index.html && echo "✅ index.html exists" || (echo "❌ Build failed - no index.html" && exit 1)

# ============================================
# Stage 2: Production (lean runtime image)
# ============================================
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/src ./src
COPY --from=builder /app/brand ./brand
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/tsconfig.json ./

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=30s --start-period=120s --retries=5 \
  CMD node -e "const http = require('http'); http.get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["npx", "tsx", "server/index.ts"]
