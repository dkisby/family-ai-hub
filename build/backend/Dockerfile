# Multi-stage build for Node.js backend API
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install --no-audit --no-fund --legacy-peer-deps --verbose 2>&1 | tail -50

RUN if [ ! -d "node_modules" ]; then echo "ERROR: node_modules not created!"; ls -la; exit 1; fi && \
    echo "=== Checking installation ===" && \
    npm list --depth=0 && \
    echo "=== Checking @types/node ===" && \
    ls -la node_modules/@types/node/ | head -10 || echo "MISSING: @types/node"

COPY src ./src
COPY tsconfig.json .

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
EXPOSE 3001
CMD ["node", "dist/server.js"]
