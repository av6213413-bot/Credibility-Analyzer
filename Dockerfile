# Combined Dockerfile - runs Frontend + Backend + ML Service in one container
# For single-service deployment on Railway, Render, or any cloud platform

# ============ Stage 1: Build Frontend ============
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY credibility-analyzer/package*.json ./
RUN npm ci
COPY credibility-analyzer/ ./
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ============ Stage 2: Build Backend ============
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src/ ./src/
RUN npm run build

# ============ Stage 3: Production ============
FROM python:3.11-slim

# Install Node.js 20 and nginx
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    nginx \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ---- ML Service ----
WORKDIR /app/ml-service
COPY ml-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ml-service/app/ ./app/

# ---- Backend ----
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=backend-builder /app/backend/dist ./dist

# ---- Frontend static files ----
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# ---- Nginx config ----
RUN cat > /etc/nginx/sites-available/default <<'NGINX'
server {
    listen PORT_PLACEHOLDER;
    server_name _;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /health {
        proxy_pass http://127.0.0.1:3001;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        root /usr/share/nginx/html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

# ---- Startup script ----
# Launches all 3 services directly (no supervisor needed)
# Environment variables from the cloud platform are inherited by all processes
RUN cat > /app/start.sh <<'START'
#!/bin/bash
set -e

# Configure nginx port
PORT=${PORT:-8080}
sed -i "s/PORT_PLACEHOLDER/$PORT/g" /etc/nginx/sites-available/default

# Set backend defaults (use BACKEND_PORT to avoid conflicting with cloud PORT)
export NODE_ENV="${NODE_ENV:-production}"
export BACKEND_PORT=3001
export ML_SERVICE_URL="http://127.0.0.1:5000"
export CORS_ORIGINS="${CORS_ORIGINS:-*}"

# Start ML service in background
cd /app/ml-service
FLASK_ENV=production PYTHONUNBUFFERED=1 USE_GPU=false DISABLE_ML_MODEL="${DISABLE_ML_MODEL:-true}" \
  gunicorn --bind 127.0.0.1:5000 --workers 1 --timeout 120 app.main:app &
ML_PID=$!

# Wait for ML service to be ready
echo "Waiting for ML service..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:5000/health > /dev/null 2>&1; then
    echo "ML service is ready"
    break
  fi
  sleep 1
done

# Start backend in background (override PORT for backend only)
cd /app/backend
PORT=$BACKEND_PORT node dist/server.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:3001/health > /dev/null 2>&1; then
    echo "Backend is ready"
    break
  fi
  sleep 1
done

# Start nginx in foreground (keeps container alive)
echo "Starting nginx on port $PORT"
echo "All services running!"
exec nginx -g "daemon off;"
START
RUN chmod +x /app/start.sh

WORKDIR /app
EXPOSE 8080

CMD ["/app/start.sh"]
