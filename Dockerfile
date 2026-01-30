# Build stage - Compile TypeScript to JavaScript
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm ci

# Install tsc-alias to resolve path aliases after compilation
RUN npm install -D tsc-alias

# Copy source files
COPY . .

# Build frontend with Vite
RUN echo "=== Building frontend ===" && \
    npm run build:frontend 2>/dev/null || npm run build

# Compile backend TypeScript to JavaScript with path alias resolution
RUN echo "=== Compiling backend TypeScript ===" && \
    npx tsc -p tsconfig.server.json --skipLibCheck && \
    echo "=== Resolving path aliases ===" && \
    npx tsc-alias -p tsconfig.server.json

# Verify build output and determine entry point
RUN echo "=== Verifying build output ===" && \
    ls -laR dist/server/ | head -50 && \
    if [ -f dist/server/server/index.js ]; then \
      echo "Entry point: dist/server/server/index.js"; \
    elif [ -f dist/server/index.js ]; then \
      echo "Entry point: dist/server/index.js"; \
    else \
      echo "ERROR: No index.js found in dist/server/"; \
      find dist -name "index.js" 2>/dev/null; \
      exit 1; \
    fi

# Production stage - Minimal runtime image
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled backend from builder
COPY --from=builder /app/dist ./dist

# Copy compiled shared schema from dist (path aliases resolved)
COPY --from=builder /app/dist/server/shared ./dist/server/shared

# Also copy original shared for any runtime type needs
COPY --from=builder /app/shared ./shared

# Copy startup script
COPY --from=builder /app/scripts/docker-start.sh ./docker-start.sh
RUN chmod +x ./docker-start.sh

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:8080/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use startup script for reliable entry point detection
CMD ["./docker-start.sh"]
