# Stage 1: Build React SPA
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ARG VITE_ENTRA_TENANT_ID
ARG VITE_ENTRA_CLIENT_ID
ARG VITE_BACKEND_API_URL

ENV VITE_ENTRA_TENANT_ID=$VITE_ENTRA_TENANT_ID
ENV VITE_ENTRA_CLIENT_ID=$VITE_ENTRA_CLIENT_ID
ENV VITE_BACKEND_API_URL=$VITE_BACKEND_API_URL

RUN test -n "$VITE_ENTRA_CLIENT_ID" || (echo "ERROR: VITE_ENTRA_CLIENT_ID not set"; exit 1)

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

RUN echo 'server { \
  listen 80; \
  location / { \
    root /usr/share/nginx/html; \
    try_files $uri $uri/ /index.html; \
  } \
}' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
