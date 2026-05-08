# Multi-stage build for Node.js backend API
FROM node:20-alpine AS builder

WORKDIR /app

RUN echo "=== Current directory ===" && pwd && \
    echo "=== Files in /app ===" && ls -la

COPY package*.json ./

RUN echo "=== After COPY ===" && ls -la && \
    echo "=== Contents of package.json ===" && head -5 package.json

RUN npm config set legacy-peer-deps true && \
    npm ci 2>&1 || (echo "npm ci FAILED"; exit 1)

RUN echo "=== After npm ci ===" && \
    ls -la node_modules/@types/ | grep node || echo "FAILED: @types/node missing"

COPY src ./src
COPY tsconfig.json .

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm config set legacy-peer-deps true && \
    npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
EXPOSE 3001
CMD ["node", "dist/server.js"]
