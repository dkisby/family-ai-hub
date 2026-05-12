# Multi-stage build for Node.js backend API
FROM mcr.microsoft.com/mirror/docker/library/node:20-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm config set legacy-peer-deps true && npm ci

COPY src ./src
COPY tsconfig.json .

RUN npm run build

# Production stage
FROM mcr.microsoft.com/mirror/docker/library/node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm config set legacy-peer-deps true && npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
EXPOSE 3001
CMD ["node", "dist/server.js"]
