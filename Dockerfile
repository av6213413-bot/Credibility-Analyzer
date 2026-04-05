# Combined Dockerfile - runs Frontend + Backend + ML Service in one container
# For single-service deployment on Railway, Render, or any cloud platform
# All three services are managed by Supervisor behind Nginx

# ============ Stage 1: Build Frontend ============
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY credibility-analyzer/package*.json ./
RUN npm ci
COPY credibility-analyzer/ ./
ARG VITE_API_URL=/api
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

# Install Node.js 20 and nginx and supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    nginx \
    supervisor \
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
# Serves frontend at / and proxies /api + /health to the Node.js backend
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

# ---- Supervisor config ----
RUN cat > /etc/supervisor/conf.d/app.conf <<'SUPERVISOR'
[supervisord]
nodaemon=true
logfile=/var/log/supervisord.log
pidfile=/var/run/supervisord.pid

[program:ml-service]
command=gunicorn --bind 127.0.0.1:5000 --workers 2 --timeout 120 app.main:app
directory=/app/ml-service
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
environment=FLASK_ENV="production",PYTHONUNBUFFERED="1",USE_GPU="false"

[program:backend]
command=/app/run-backend.sh
directory=/app/backend
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
SUPERVISOR

# ---- Backend runner script (inherits env vars from parent process) ----
RUN cat > /app/run-backend.sh <<'BACKEND'
#!/bin/bash
export NODE_ENV="${NODE_ENV:-production}"
export PORT="3001"
export ML_SERVICE_URL="http://127.0.0.1:5000"
export CORS_ORIGINS="${CORS_ORIGINS:-*}"
# MONGODB_URI and REDIS_URI are inherited from the parent environment
exec node dist/server.js
BACKEND
RUN chmod +x /app/run-backend.sh

# ---- Startup script ----
RUN cat > /app/start.sh <<'START'
#!/bin/bash
PORT=${PORT:-8080}
sed -i "s/PORT_PLACEHOLDER/$PORT/g" /etc/nginx/sites-available/default

exec supervisord -c /etc/supervisor/supervisord.conf
START
RUN chmod +x /app/start.sh

WORKDIR /app
EXPOSE 8080

CMD ["/app/start.sh"]
