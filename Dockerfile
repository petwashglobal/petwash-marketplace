# ─────────────────────────────────────────────────────────────────────────────
# PetWash™ — Cloud Run Backend Dockerfile
# Architecture: Firebase Hosting (frontend) + Cloud Run (API backend)
# Firebase routes /api/** → this container via firebase.json rewrites
#
# Frontend Vite bundle (dist/) is pre-built by CI before docker build runs.
# No VITE_* build-args are needed here — eliminates GitHub secret-scanning
# warnings on ARG/ENV instructions and the resulting error annotation.
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Install dependencies
FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy full source (dist/ is pre-built by CI and present in the build context)
COPY . .

# Stage 2: Production runtime (minimal)
FROM node:20-slim AS runner
WORKDIR /app

# Install dumb-init for proper signal handling (SIGTERM on Cloud Run scale-down)
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*

# Copy only what the server needs at runtime
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/drizzle.config.ts ./

# Install production dependencies + tsx for TypeScript execution
RUN npm install --omit=dev --legacy-peer-deps && npm install tsx

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 petwash

# Pre-create writable directories needed at runtime, owned by the app user
# /app/uploads — compliance-identity.ts creates this at module load (UPLOAD_ROOT)
# /app/uploads/identity — ID document storage sub-directory
RUN mkdir -p /app/uploads/identity && chown -R petwash:nodejs /app/uploads

USER petwash

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

# dumb-init ensures SIGTERM is passed to Node.js correctly (graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "tsx", "server/index.ts"]
