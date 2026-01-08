# Dockerfile for Credibility Analyzer Frontend
# For Render deployment

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy frontend package files
COPY credibility-analyzer/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY credibility-analyzer/ ./

# Build the application
RUN npm run build

# Stage 2: Production with nginx
FROM nginx:alpine

# Copy custom nginx configuration
COPY credibility-analyzer/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
