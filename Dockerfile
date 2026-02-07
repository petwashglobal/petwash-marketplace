# Stage 1: Build the application
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production runtime (minimal image)
FROM node:20-alpine AS runner
WORKDIR /app
# Copy only the compiled production files from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

# Install only essential production dependencies
RUN npm install --omit=dev

# tsx is often needed for server/index.ts if it's not compiled to CJS
RUN npm install -g tsx

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

CMD ["tsx", "server/index.ts"]
