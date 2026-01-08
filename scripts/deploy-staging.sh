#!/bin/bash
# deploy-staging.sh - Deployment script for staging environment
# Usage: ./deploy-staging.sh <registry> <image_tag>
#
# Requirements: 4.1 - Deploy to staging environment when images are pushed

set -e

# Configuration
REGISTRY="${1:-docker.io}"
IMAGE_TAG="${2:-latest}"
DEPLOY_DIR="/opt/credibility-analyzer"
COMPOSE_FILE="docker-compose.staging.yml"
MAX_HEALTH_RETRIES=30
HEALTH_CHECK_INTERVAL=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Health check function
check_health() {
    local service_url="$1"
    local retries=0
    
    log_info "Checking health at $service_url..."
    
    while [ $retries -lt $MAX_HEALTH_RETRIES ]; do
        if curl -sf "$service_url" > /dev/null 2>&1; then
            log_info "Health check passed!"
            return 0
        fi
        
        retries=$((retries + 1))
        log_warn "Health check attempt $retries/$MAX_HEALTH_RETRIES failed, retrying in ${HEALTH_CHECK_INTERVAL}s..."
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    log_error "Health check failed after $MAX_HEALTH_RETRIES attempts"
    return 1
}

# Main deployment function
deploy() {
    log_info "Starting staging deployment..."
    log_info "Registry: $REGISTRY"
    log_info "Image Tag: $IMAGE_TAG"
    
    # Navigate to deployment directory
    cd "$DEPLOY_DIR" || {
        log_error "Failed to navigate to $DEPLOY_DIR"
        exit 1
    }
    
    # Export environment variables for docker-compose
    export REGISTRY="$REGISTRY"
    export IMAGE_TAG="$IMAGE_TAG"
    
    # Pull latest images
    log_info "Pulling latest images..."
    docker-compose -f "$COMPOSE_FILE" pull || {
        log_error "Failed to pull images"
        exit 1
    }
    
    # Stop existing containers gracefully
    log_info "Stopping existing containers..."
    docker-compose -f "$COMPOSE_FILE" down --timeout 30 || {
        log_warn "Some containers may not have stopped cleanly"
    }
    
    # Start new containers
    log_info "Starting new containers..."
    docker-compose -f "$COMPOSE_FILE" up -d || {
        log_error "Failed to start containers"
        exit 1
    }
    
    # Wait for services to initialize
    log_info "Waiting for services to initialize..."
    sleep 15
    
    # Perform health checks
    log_info "Performing health checks..."
    
    # Check API health
    if ! check_health "http://localhost:3000/health"; then
        log_error "API health check failed"
        exit 1
    fi
    
    # Check nginx health (via API proxy)
    if ! check_health "http://localhost/health"; then
        log_error "Nginx proxy health check failed"
        exit 1
    fi
    
    # Check ready endpoint
    if ! check_health "http://localhost/ready"; then
        log_error "Ready endpoint check failed"
        exit 1
    fi
    
    log_info "Staging deployment completed successfully!"
    log_info "Services are running with image tag: $IMAGE_TAG"
    
    # Display running containers
    log_info "Running containers:"
    docker-compose -f "$COMPOSE_FILE" ps
}

# Rollback function
rollback() {
    log_warn "Rolling back deployment..."
    
    cd "$DEPLOY_DIR" || exit 1
    
    # Stop current containers
    docker-compose -f "$COMPOSE_FILE" down --timeout 30
    
    # Start with previous tag
    export IMAGE_TAG="previous"
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log_info "Rollback completed"
}

# Main execution
case "${3:-deploy}" in
    deploy)
        deploy
        ;;
    rollback)
        rollback
        ;;
    *)
        echo "Usage: $0 <registry> <image_tag> [deploy|rollback]"
        exit 1
        ;;
esac
