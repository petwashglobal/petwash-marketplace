# Production Docker image - runs TypeScript directly with tsx (same as development)
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files first for better layer caching
COPY package*.json ./

# Install ALL dependencies (tsx needs devDependencies)
RUN npm ci

# Copy source files
COPY . .

# Build frontend with Vite (MUST succeed for production)
RUN echo "=== Building frontend ===" && \
    npm run build && \
    echo "=== Verifying build output ===" && \
    ls -la dist/public/ && \
    test -f dist/public/index.html && echo "✅ index.html exists" || (echo "❌ Build failed - no index.html" && exit 1)

# Remove unnecessary files to reduce image size (AFTER successful build)
RUN rm -rf .git attached_assets client/src 2>/dev/null || true

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check with longer timeout for cold starts
HEALTHCHECK --interval=30s --timeout=30s --start-period=120s --retries=5 \
  CMD node -e "const http = require('http'); http.get('http://localhost:8080/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Run TypeScript directly with tsx (same as development, guaranteed to work)
CMD ["npx", "tsx", "server/index.ts"]
