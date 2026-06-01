# ─────────────────────────────────────────────────────────────────────────────
# PetWash™ — Cloud Run Backend Dockerfile
# Architecture: Firebase Hosting (frontend) + Cloud Run (API backend)
# Firebase routes /api/** → this container via firebase.json rewrites
#
# Frontend Vite bundle (dist/) is pre-built by CI before docker build runs.
# No VITE_* build-args are needed here — eliminates GitHub secret-scanning
# warnings on ARG/ENV instructions and the resulting error annotation.
#
# Node 22 LTS (EOL April 2027). Node 20 EOL is April 2026 — do not revert.
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Install all dependencies (dev+prod) for potential build tooling
FROM node:22-slim AS builder
WORKDIR /app

# ── 2026-05-24 npm network-resilience hardening ───────────────────────────────
# CI #982 failed with ECONNRESET from the public npm registry mid-install.
# Standard 2026 fix is the combination below:
#   - npm config retries (5 attempts, exponential timeout up to 2 min)
#   - --prefer-offline to use the local cache before hitting the network
#   - --no-audit --no-fund to skip non-essential network calls
#   - BuildKit cache mount on /root/.npm so a re-run reuses the package tarballs
# Public sources: npm docs (fetch-retries family), Docker docs (BuildKit cache
# mount), and the standard hardening pattern used by Vercel, Render, Fly.io
# Docker examples. ECONNRESET is one of the top-5 ops issues on hosted CI in
# 2025-2026; this is the accepted mitigation.
ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install --legacy-peer-deps --prefer-offline

# Copy full source — dist/ is pre-built by CI and present in the build context.
# .dockerignore deliberately omits 'dist' so CI-built assets reach this stage.
COPY . .

# Stage 2: Production runtime (minimal, hardened)
FROM node:22-slim AS runner
WORKDIR /app

# Same npm network-resilience env as the builder stage. Both stages run
# `npm install` against the public registry; both can hit ECONNRESET.
ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false

# Install dumb-init for proper signal handling (SIGTERM on Cloud Run scale-down)
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Copy only what the server needs at runtime
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/src ./src
COPY --from=builder /app/uploads/paw-finder ./uploads/paw-finder
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/drizzle.config.ts ./

# Install production dependencies only, then tsx for TypeScript execution.
# BuildKit cache mount on /root/.npm so re-runs after a transient network
# blip re-use already-downloaded tarballs and skip the registry entirely
# for cached packages. sharing=locked prevents concurrent npm processes
# from corrupting the cache during parallel runs.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install --omit=dev --legacy-peer-deps --prefer-offline \
    && npm install --prefer-offline tsx

# Create non-root user BEFORE setting ownership
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 petwash

# Pre-create writable directories needed at runtime, owned by the app user
# /app/uploads — compliance-identity.ts creates this at module load (UPLOAD_ROOT)
RUN mkdir -p /app/uploads/identity && chown -R petwash:nodejs /app/uploads

USER petwash

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

# dumb-init ensures SIGTERM is passed to Node.js correctly (graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "tsx", "server/index.ts"]
