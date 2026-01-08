#!/bin/bash
# deploy-production.sh - Rolling deployment script for production environment
# Usage: ./deploy-production.sh <registry> <image_tag> [deploy|rollback]
#
# Requirements: 5.3 - Rolling updates with zero downtime
# Implements rolling deployment strategy to ensure zero-downtime updates

set -e

# Configuration
REGISTRY="${1:-docker.io}"
IMAGE_TAG="${2:-latest}"
ACTION="${3:-deploy}"
DEPLOY_DIR="/opt/credibility-analyzer"
COMPOSE_FILE="docker-compose.production.yml"
MAX_HEALTH_RETRIES=60
HEALTH_CHECK_INTERVAL=5
ROLLBACK_TAG="previous"
API_REPLICAS="${API_REPLICAS:-3}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Health check function with retries
check_health() {
    local service_url="$1"
    local service_name="$2"
    local retries=0
    
    log_info "Checking health of $service_name at $service_url..."
    
    while [ $retries -lt $MAX_HEALTH_RETRIES ]; do
        if curl -sf "$service_url" > /dev/null 2>&1; then
            log_info "$service_name health check passed!"
            return 0
        fi
        
        retries=$((retries + 1))
        if [ $((retries % 10)) -eq 0 ]; then
            log_warn "$service_name health check attempt $retries/$MAX_HEALTH_RETRIES..."
        fi
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    log_error "$service_name health check failed after $MAX_HEALTH_RETRIES attempts"
    return 1
}

# Check if all API instances are healthy
check_api_instances() {
    local healthy_count=0
    local expected_count="$1"
    
    log_info "Checking API instance health (expecting $expected_count healthy instances)..."
    
    # Get container IDs for API service
    local containers=$(docker-compose -f "$COMPOSE_FILE" ps -q api 2>/dev/null || echo "")
    
    if [ -z "$containers" ]; then
        log_warn "No API containers found"
        return 1
    fi
    
    for container in $containers; do
        local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")
        if [ "$health" = "healthy" ]; then
            healthy_count=$((healthy_count + 1))
        fi
    done
    
    log_info "Healthy API instances: $healthy_count/$expected_count"
    
    if [ "$healthy_count" -ge "$expected_count" ]; then
        return 0
    fi
    return 1
}

# Tag current images as 'previous' for rollback
tag_current_as_previous() {
    log_step "Tagging current images as 'previous' for rollback capability..."
    
    # Tag backend
    if docker image inspect "${REGISTRY}/backend:latest" > /dev/null 2>&1; then
        docker tag "${REGISTRY}/backend:latest" "${REGISTRY}/backend:${ROLLBACK_TAG}" || true
    fi
    
    # Tag frontend
    if docker image inspect "${REGISTRY}/credibility-analyzer:latest" > /dev/null 2>&1; then
        docker tag "${REGISTRY}/credibility-analyzer:latest" "${REGISTRY}/credibility-analyzer:${ROLLBACK_TAG}" || true
    fi
    
    # Tag ML service
    if docker image inspect "${REGISTRY}/ml-service:latest" > /dev/null 2>&1; then
        docker tag "${REGISTRY}/ml-service:latest" "${REGISTRY}/ml-service:${ROLLBACK_TAG}" || true
    fi
    
    log_info "Current images tagged as '${ROLLBACK_TAG}'"
}

# Rolling update for a specific service
rolling_update_service() {
    local service="$1"
    local replicas="$2"
    
    log_step "Performing rolling update for $service (replicas: $replicas)..."
    
    # Update one instance at a time
    for i in $(seq 1 $replicas); do
        log_info "Updating $service instance $i of $replicas..."
        
        # Scale down by 1
        docker-compose -f "$COMPOSE_FILE" up -d --no-deps --scale "$service=$((replicas - 1))" "$service" || {
            log_error "Failed to scale down $service"
            return 1
        }
        
        sleep 5
        
        # Scale back up with new image
        docker-compose -f "$COMPOSE_FILE" up -d --no-deps --scale "$service=$replicas" "$service" || {
            log_error "Failed to scale up $service"
            return 1
        }
        
        # Wait for the new instance to be healthy
        sleep 10
        
        if ! check_api_instances 1; then
            log_error "New instance failed health check during rolling update"
            return 1
        fi
        
        log_info "$service instance $i updated successfully"
    done
    
    log_info "Rolling update for $service completed"
    return 0
}

# Main deployment function with zero-downtime rolling updates
deploy() {
    log_step "Starting production deployment..."
    log_info "Registry: $REGISTRY"
    log_info "Image Tag: $IMAGE_TAG"
    log_info "API Replicas: $API_REPLICAS"
    
    # Navigate to deployment directory
    cd "$DEPLOY_DIR" || {
        log_error "Failed to navigate to $DEPLOY_DIR"
        exit 1
    }
    
    # Export environment variables for docker-compose
    export REGISTRY="$REGISTRY"
    export IMAGE_TAG="$IMAGE_TAG"
    export API_REPLICAS="$API_REPLICAS"
    
    # Tag current images for rollback
    tag_current_as_previous
    
    # Pull new images
    log_step "Pulling new images..."
    docker-compose -f "$COMPOSE_FILE" pull || {
        log_error "Failed to pull images"
        exit 1
    }
    
    # Check if services are already running
    if docker-compose -f "$COMPOSE_FILE" ps -q api 2>/dev/null | grep -q .; then
        log_info "Existing deployment detected, performing rolling update..."
        
        # Update ML service first (backend depends on it)
        log_step "Updating ML service..."
        docker-compose -f "$COMPOSE_FILE" up -d --no-deps ml-service || {
            log_error "Failed to update ML service"
            exit 1
        }
        
        # Wait for ML service to be healthy
        sleep 15
        if ! check_health "http://localhost:5000/health" "ML Service"; then
            log_error "ML service health check failed"
            exit 1
        fi
        
        # Perform rolling update on API instances
        log_step "Performing rolling update on API instances..."
        
        # Update API service with rolling strategy
        docker-compose -f "$COMPOSE_FILE" up -d --no-deps --scale api=$API_REPLICAS api || {
            log_error "Failed to update API service"
            exit 1
        }
        
        # Wait for all API instances to be healthy
        sleep 20
        local retries=0
        while [ $retries -lt 30 ]; do
            if check_api_instances "$API_REPLICAS"; then
                break
            fi
            retries=$((retries + 1))
            sleep 5
        done
        
        if [ $retries -ge 30 ]; then
            log_error "API instances failed to become healthy"
            exit 1
        fi
        
        # Update frontend
        log_step "Updating frontend..."
        docker-compose -f "$COMPOSE_FILE" up -d --no-deps frontend || {
            log_error "Failed to update frontend"
            exit 1
        }
        
        # Reload nginx to pick up any config changes
        log_step "Reloading nginx..."
        docker-compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload || {
            log_warn "Nginx reload failed, restarting..."
            docker-compose -f "$COMPOSE_FILE" restart nginx
        }
        
    else
        log_info "No existing deployment, starting fresh..."
        docker-compose -f "$COMPOSE_FILE" up -d || {
            log_error "Failed to start services"
            exit 1
        }
    fi
    
    # Final health checks
    log_step "Running final health checks..."
    sleep 10
    
    if ! check_health "http://localhost/health" "Nginx Proxy"; then
        log_error "Final health check failed"
        exit 1
    fi
    
    if ! check_health "http://localhost/ready" "Ready Endpoint"; then
        log_error "Ready endpoint check failed"
        exit 1
    fi
    
    if ! check_health "http://localhost/api/health" "API Health"; then
        log_error "API health check failed"
        exit 1
    fi
    
    log_info "=========================================="
    log_info "Production deployment completed successfully!"
    log_info "Image tag: $IMAGE_TAG"
    log_info "=========================================="
    
    # Display running containers
    log_info "Running containers:"
    docker-compose -f "$COMPOSE_FILE" ps
}

# Rollback function
rollback() {
    log_step "Starting production rollback..."
    log_warn "Rolling back to previous version..."
    
    cd "$DEPLOY_DIR" || {
        log_error "Failed to navigate to $DEPLOY_DIR"
        exit 1
    }
    
    # Set image tag to previous
    export REGISTRY="$REGISTRY"
    export IMAGE_TAG="$ROLLBACK_TAG"
    export API_REPLICAS="$API_REPLICAS"
    
    # Check if previous images exist
    if ! docker image inspect "${REGISTRY}/backend:${ROLLBACK_TAG}" > /dev/null 2>&1; then
        log_error "No previous images found for rollback"
        exit 1
    fi
    
    log_info "Rolling back to images tagged '${ROLLBACK_TAG}'..."
    
    # Perform rollback with the same rolling strategy
    docker-compose -f "$COMPOSE_FILE" up -d --no-deps ml-service || {
        log_error "Failed to rollback ML service"
        exit 1
    }
    
    sleep 10
    
    docker-compose -f "$COMPOSE_FILE" up -d --no-deps --scale api=$API_REPLICAS api || {
        log_error "Failed to rollback API service"
        exit 1
    }
    
    sleep 15
    
    docker-compose -f "$COMPOSE_FILE" up -d --no-deps frontend || {
        log_error "Failed to rollback frontend"
        exit 1
    }
    
    # Reload nginx
    docker-compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload || {
        docker-compose -f "$COMPOSE_FILE" restart nginx
    }
    
    # Verify rollback
    sleep 10
    if check_health "http://localhost/health" "Rollback Health"; then
        log_info "=========================================="
        log_info "Rollback completed successfully!"
        log_info "=========================================="
    else
        log_error "Rollback health check failed - manual intervention required"
        exit 1
    fi
    
    docker-compose -f "$COMPOSE_FILE" ps
}

# Status function
status() {
    cd "$DEPLOY_DIR" || exit 1
    
    log_info "Current deployment status:"
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo ""
    log_info "Container health:"
    docker-compose -f "$COMPOSE_FILE" ps -q | xargs -I {} docker inspect --format='{{.Name}}: {{.State.Health.Status}}' {} 2>/dev/null || echo "No containers running"
}

# Main execution
case "$ACTION" in
    deploy)
        deploy
        ;;
    rollback)
        rollback
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 <registry> <image_tag> [deploy|rollback|status]"
        echo ""
        echo "Arguments:"
        echo "  registry    Container registry URL (default: docker.io)"
        echo "  image_tag   Image tag to deploy (default: latest)"
        echo ""
        echo "Actions:"
        echo "  deploy      Deploy new version with rolling updates (default)"
        echo "  rollback    Rollback to previous version"
        echo "  status      Show current deployment status"
        exit 1
        ;;
esac
