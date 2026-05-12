# Stage 1: Build React SPA
FROM mcr.microsoft.com/mirror/docker/library/node:20-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ARG VITE_ENTRA_TENANT_ID
ARG VITE_ENTRA_CLIENT_ID
ARG VITE_ENTRA_API_CLIENT_ID
ARG VITE_ENTRA_API_SCOPE
ARG VITE_BACKEND_API_URL

ENV VITE_ENTRA_TENANT_ID=$VITE_ENTRA_TENANT_ID
ENV VITE_ENTRA_CLIENT_ID=$VITE_ENTRA_CLIENT_ID
ENV VITE_ENTRA_API_CLIENT_ID=$VITE_ENTRA_API_CLIENT_ID
ENV VITE_ENTRA_API_SCOPE=$VITE_ENTRA_API_SCOPE
ENV VITE_BACKEND_API_URL=$VITE_BACKEND_API_URL

RUN test -n "$VITE_ENTRA_CLIENT_ID" || (echo "ERROR: VITE_ENTRA_CLIENT_ID not set"; exit 1)

RUN npm run build

# Stage 2: Serve static files with Node to avoid Docker Hub nginx pull limits
FROM mcr.microsoft.com/mirror/docker/library/node:20-bookworm-slim

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 80

CMD ["serve", "-s", "dist", "-l", "80"]
