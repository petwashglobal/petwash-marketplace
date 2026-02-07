# Stage 1: Build the application
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
# Use --legacy-peer-deps to avoid dependency resolution conflicts in slim image
RUN npm install --legacy-peer-deps
COPY . .
# Ensure the assets folder is explicitly copied for the build process
COPY attached_assets ./attached_assets
# Ensure build script runs pre-requisites
RUN npm run build

# Stage 2: Production runtime (minimal image)
FROM node:20-alpine AS runner
WORKDIR /app

# Install system dependencies for native modules if needed
RUN apk add --no-cache python3 make g++

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/src ./src
COPY --from=builder /app/attached_assets ./attached_assets
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/drizzle.config.ts ./

# Install ONLY production dependencies
RUN npm install --omit=dev --legacy-peer-deps

# Ensure tsx is available for server execution
RUN npm install -g tsx

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

# Use npx to ensure local version of tsx is used if available, or fallback to global
CMD ["npx", "tsx", "server/index.ts"]
