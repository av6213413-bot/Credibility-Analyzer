#!/bin/bash
# setup-ssl.sh - Initial SSL certificate setup using Let's Encrypt
# Usage: ./setup-ssl.sh <domain> [email] [staging]
#
# Requirements: 7.1 - SSL certificate provisioned via Let's Encrypt
# This script installs certbot and requests initial certificates

set -e

# Configuration
DOMAIN="${1:-}"
EMAIL="${2:-admin@${DOMAIN}}"
STAGING="${3:-}"  # Pass 'staging' for Let's Encrypt staging environment
WEBROOT_PATH="/var/www/certbot"
CERT_PATH="/etc/letsencrypt/live"
NGINX_CONTAINER="nginx"

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

# Validate domain argument
validate_domain() {
    if [ -z "$DOMAIN" ]; then
        log_error "Domain is required"
        echo "Usage: $0 <domain> [email] [staging]"
        echo ""
        echo "Arguments:"
        echo "  domain    Primary domain (e.g., fakechecker.com)"
        echo "  email     Email for Let's Encrypt notifications (default: admin@domain)"
        echo "  staging   Pass 'staging' to use Let's Encrypt staging environment"
        exit 1
    fi
    
    # Basic domain validation
    if ! echo "$DOMAIN" | grep -qE '^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$'; then
        log_error "Invalid domain format: $DOMAIN"
        exit 1
    fi
    
    log_info "Domain: $DOMAIN"
    log_info "Email: $EMAIL"
}

# Check if running as root or with sudo
check_permissions() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root or with sudo"
        exit 1
    fi
}

# Install certbot if not present
install_certbot() {
    log_step "Checking certbot installation..."
    
    if command -v certbot &> /dev/null; then
        log_info "Certbot is already installed: $(certbot --version)"
        return 0
    fi
    
    log_info "Installing certbot..."
    
    # Detect OS and install accordingly
    if [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        apt-get update
        apt-get install -y certbot
    elif [ -f /etc/redhat-release ]; then
        # RHEL/CentOS/Fedora
        if command -v dnf &> /dev/null; then
            dnf install -y certbot
        else
            yum install -y certbot
        fi
    elif [ -f /etc/alpine-release ]; then
        # Alpine
        apk add --no-cache certbot
    else
        log_error "Unsupported OS. Please install certbot manually."
        exit 1
    fi
    
    log_info "Certbot installed successfully: $(certbot --version)"
}

# Create webroot directory for ACME challenges
setup_webroot() {
    log_step "Setting up webroot directory for ACME challenges..."
    
    mkdir -p "$WEBROOT_PATH"
    chmod 755 "$WEBROOT_PATH"
    
    log_info "Webroot directory created: $WEBROOT_PATH"
}

# Verify nginx is configured for ACME challenges
verify_nginx_config() {
    log_step "Verifying nginx ACME challenge configuration..."
    
    # Check if nginx container is running
    if docker ps --format '{{.Names}}' | grep -q "$NGINX_CONTAINER"; then
        log_info "Nginx container is running"
        
        # Test ACME challenge location
        mkdir -p "$WEBROOT_PATH/.well-known/acme-challenge"
        echo "test" > "$WEBROOT_PATH/.well-known/acme-challenge/test"
        
        if curl -sf "http://localhost/.well-known/acme-challenge/test" > /dev/null 2>&1; then
            log_info "ACME challenge location is accessible"
            rm -f "$WEBROOT_PATH/.well-known/acme-challenge/test"
        else
            log_warn "ACME challenge location may not be accessible"
            log_warn "Ensure nginx is configured with: location /.well-known/acme-challenge/ { root /var/www/certbot; }"
            rm -f "$WEBROOT_PATH/.well-known/acme-challenge/test"
        fi
    else
        log_warn "Nginx container not found. Ensure nginx is running before requesting certificates."
    fi
}

# Request initial certificate from Let's Encrypt
request_certificate() {
    log_step "Requesting SSL certificate from Let's Encrypt..."
    
    local certbot_args=(
        "certonly"
        "--webroot"
        "-w" "$WEBROOT_PATH"
        "-d" "$DOMAIN"
        "-d" "www.$DOMAIN"
        "--email" "$EMAIL"
        "--agree-tos"
        "--non-interactive"
        "--keep-until-expiring"
    )
    
    # Use staging environment if specified
    if [ "$STAGING" = "staging" ]; then
        log_warn "Using Let's Encrypt STAGING environment (certificates will not be trusted)"
        certbot_args+=("--staging")
    fi
    
    log_info "Running certbot with webroot authentication..."
    
    if certbot "${certbot_args[@]}"; then
        log_info "Certificate obtained successfully!"
    else
        log_error "Failed to obtain certificate"
        log_error "Common issues:"
        log_error "  - Domain DNS not pointing to this server"
        log_error "  - Port 80 not accessible from internet"
        log_error "  - Nginx not configured for ACME challenges"
        exit 1
    fi
}

# Configure certificate paths and permissions
configure_certificates() {
    log_step "Configuring certificate paths and permissions..."
    
    local cert_dir="$CERT_PATH/$DOMAIN"
    
    if [ -d "$cert_dir" ]; then
        log_info "Certificate directory: $cert_dir"
        log_info "Certificate files:"
        ls -la "$cert_dir/"
        
        # Set appropriate permissions
        chmod 755 /etc/letsencrypt/live
        chmod 755 /etc/letsencrypt/archive
        chmod 644 "$cert_dir/fullchain.pem" 2>/dev/null || true
        chmod 600 "$cert_dir/privkey.pem" 2>/dev/null || true
        
        log_info "Certificate paths configured:"
        log_info "  Certificate: $cert_dir/fullchain.pem"
        log_info "  Private Key: $cert_dir/privkey.pem"
    else
        log_error "Certificate directory not found: $cert_dir"
        exit 1
    fi
}

# Reload nginx to use new certificates
reload_nginx() {
    log_step "Reloading nginx to use new certificates..."
    
    if docker ps --format '{{.Names}}' | grep -q "$NGINX_CONTAINER"; then
        if docker exec "$NGINX_CONTAINER" nginx -t; then
            docker exec "$NGINX_CONTAINER" nginx -s reload
            log_info "Nginx reloaded successfully"
        else
            log_error "Nginx configuration test failed"
            exit 1
        fi
    else
        log_warn "Nginx container not running. Reload nginx manually after starting it."
    fi
}

# Verify SSL certificate
verify_certificate() {
    log_step "Verifying SSL certificate..."
    
    local cert_file="$CERT_PATH/$DOMAIN/fullchain.pem"
    
    if [ -f "$cert_file" ]; then
        log_info "Certificate details:"
        openssl x509 -in "$cert_file" -noout -subject -issuer -dates
        
        # Check expiration
        local expiry=$(openssl x509 -in "$cert_file" -noout -enddate | cut -d= -f2)
        log_info "Certificate expires: $expiry"
    else
        log_error "Certificate file not found: $cert_file"
        exit 1
    fi
}

# Display next steps
display_next_steps() {
    log_info "=========================================="
    log_info "SSL Certificate Setup Complete!"
    log_info "=========================================="
    echo ""
    log_info "Certificate location: $CERT_PATH/$DOMAIN/"
    log_info "  - fullchain.pem (certificate + chain)"
    log_info "  - privkey.pem (private key)"
    echo ""
    log_info "Next steps:"
    log_info "  1. Update nginx configuration to use SSL certificates"
    log_info "  2. Set up automatic renewal with: ./renew-ssl.sh"
    log_info "  3. Configure cron job for daily renewal checks"
    echo ""
    log_info "Nginx SSL configuration example:"
    echo "    ssl_certificate $CERT_PATH/$DOMAIN/fullchain.pem;"
    echo "    ssl_certificate_key $CERT_PATH/$DOMAIN/privkey.pem;"
}

# Main execution
main() {
    log_info "Starting SSL certificate setup..."
    
    validate_domain
    check_permissions
    install_certbot
    setup_webroot
    verify_nginx_config
    request_certificate
    configure_certificates
    reload_nginx
    verify_certificate
    display_next_steps
}

main
