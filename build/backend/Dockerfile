# Multi-stage build for Node.js backend API
FROM node:20-alpine AS builder

WORKDIR /app

COPY .npmrc package*.json ./

RUN npm ci

RUN ls -la node_modules/@types/node || (echo "FAILED: @types/node not installed" && exit 1)

COPY src ./src
COPY tsconfig.json .

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY .npmrc package*.json ./
RUN npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
EXPOSE 3001
CMD ["node", "dist/server.js"]
