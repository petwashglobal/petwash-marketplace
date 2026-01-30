# Build stage - Compile TypeScript to JavaScript
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

# Build frontend with Vite
RUN npm run build:frontend 2>/dev/null || (echo "build:frontend not found, running build" && npm run build)

# Compile backend TypeScript to JavaScript
RUN npx tsc -p tsconfig.server.json --skipLibCheck 2>/dev/null || \
    npx tsc --outDir dist/server --rootDir . --module NodeNext --moduleResolution NodeNext \
    --esModuleInterop --skipLibCheck --target ES2022 \
    server/index.ts

# Production stage - Minimal runtime image
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled backend
COPY --from=builder /app/dist ./dist

# Copy shared schema (may be needed at runtime)
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/server/index.js"]
