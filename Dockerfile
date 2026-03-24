# ─────────────────────────────────────────────────────────────────────────────
# PetWash™ — Cloud Run Backend Dockerfile
# Architecture: Firebase Hosting (frontend) + Cloud Run (API backend)
# Firebase routes /api/** → this container via firebase.json rewrites
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app

# Build-time variables for Vite frontend bundle.
# All ARGs must be supplied via --build-arg or CI secrets — no hardcoded defaults.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID
ARG VITE_FIREBASE_VAPID_KEY
ARG VITE_RECAPTCHA_SITE_KEY
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_WEBAUTHN_RP_ID

# Export ARGs as ENV so Vite picks them up during `npm run build`
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_MEASUREMENT_ID=$VITE_FIREBASE_MEASUREMENT_ID
ENV VITE_FIREBASE_VAPID_KEY=$VITE_FIREBASE_VAPID_KEY
ENV VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_WEBAUTHN_RP_ID=$VITE_WEBAUTHN_RP_ID

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

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
