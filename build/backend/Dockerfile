# Multi-stage build for Node.js backend API
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install --legacy-peer-deps

RUN echo "=== Checking @types/node ===" && \
    npm list @types/node && \
    echo "=== Node modules contents ===" && \
    ls -la node_modules/@types/ | head -20 || echo "@types directory not found"

COPY src ./src
COPY tsconfig.json .

RUN echo "=== tsconfig.json ===" && cat tsconfig.json && echo "=== Running build ===" && npm run build

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
