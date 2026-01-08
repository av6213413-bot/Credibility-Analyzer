#!/bin/bash
# renew-ssl.sh - SSL certificate renewal script
# Usage: ./renew-ssl.sh [--force] [--dry-run]
#
# Requirements: 7.2 - SSL certificate automatically renewed before expiration
# This script renews certificates and reloads nginx

set -e

# Configuration
CERT_PATH="/etc/letsencrypt/live"
WEBROOT_PATH="/var/www/certbot"
NGINX_CONTAINER="nginx"
LOG_FILE="/var/log/certbot-renewal.log"
RENEWAL_THRESHOLD_DAYS=30

# Parse arguments
FORCE_RENEWAL=""
DRY_RUN=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_RENEWAL="--force-renewal"
            shift
            ;;
        --dry-run)
            DRY_RUN="--dry-run"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    local msg="[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1"
    echo -e "${GREEN}${msg}${NC}"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

log_warn() {
    local msg="[WARN] $(date '+%Y-%m-%d %H:%M:%S') - $1"
    echo -e "${YELLOW}${msg}${NC}"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

log_error() {
    local msg="[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1"
    echo -e "${RED}${msg}${NC}"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

log_step() {
    local msg="[STEP] $(date '+%Y-%m-%d %H:%M:%S') - $1"
    echo -e "${BLUE}${msg}${NC}"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

# Ensure log directory exists
setup_logging() {
    local log_dir=$(dirname "$LOG_FILE")
    mkdir -p "$log_dir" 2>/dev/null || true
    touch "$LOG_FILE" 2>/dev/null || true
}

# Check if certbot is installed
check_certbot() {
    if ! command -v certbot &> /dev/null; then
        log_error "Certbot is not installed. Run setup-ssl.sh first."
        exit 1
    fi
}

# Check certificate expiration
check_expiration() {
    log_step "Checking certificate expiration..."
    
    local certs_found=0
    local certs_expiring=0
    
    for cert_dir in "$CERT_PATH"/*/; do
        if [ -d "$cert_dir" ]; then
            local domain=$(basename "$cert_dir")
            local cert_file="$cert_dir/fullchain.pem"
            
            if [ -f "$cert_file" ]; then
                certs_found=$((certs_found + 1))
                
                # Get expiration date
                local expiry_date=$(openssl x509 -in "$cert_file" -noout -enddate 2>/dev/null | cut -d= -f2)
                local expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s 2>/dev/null)
                local current_epoch=$(date +%s)
                local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
                
                log_info "Domain: $domain"
                log_info "  Expires: $expiry_date"
                log_info "  Days until expiry: $days_until_expiry"
                
                if [ "$days_until_expiry" -lt "$RENEWAL_THRESHOLD_DAYS" ]; then
                    log_warn "  Certificate will expire soon!"
                    certs_expiring=$((certs_expiring + 1))
                fi
            fi
        fi
    done
    
    if [ "$certs_found" -eq 0 ]; then
        log_warn "No certificates found in $CERT_PATH"
        return 1
    fi
    
    log_info "Found $certs_found certificate(s), $certs_expiring expiring within $RENEWAL_THRESHOLD_DAYS days"
    return 0
}

# Renew certificates
renew_certificates() {
    log_step "Renewing SSL certificates..."
    
    local certbot_args=(
        "renew"
        "--webroot"
        "-w" "$WEBROOT_PATH"
        "--quiet"
        "--no-random-sleep-on-renew"
    )
    
    if [ -n "$FORCE_RENEWAL" ]; then
        log_warn "Force renewal enabled"
        certbot_args+=("$FORCE_RENEWAL")
    fi
    
    if [ -n "$DRY_RUN" ]; then
        log_warn "Dry run mode - no actual renewal will occur"
        certbot_args+=("$DRY_RUN")
    fi
    
    log_info "Running: certbot ${certbot_args[*]}"
    
    if certbot "${certbot_args[@]}"; then
        log_info "Certificate renewal completed successfully"
        return 0
    else
        log_error "Certificate renewal failed"
        return 1
    fi
}

# Reload nginx after certificate renewal
reload_nginx() {
    log_step "Reloading nginx to apply renewed certificates..."
    
    # Skip nginx reload in dry-run mode
    if [ -n "$DRY_RUN" ]; then
        log_info "Dry run mode - skipping nginx reload"
        return 0
    fi
    
    # Try Docker container first
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "$NGINX_CONTAINER"; then
        log_info "Reloading nginx container..."
        
        # Test nginx configuration first
        if docker exec "$NGINX_CONTAINER" nginx -t 2>/dev/null; then
            if docker exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null; then
                log_info "Nginx container reloaded successfully"
                return 0
            else
                log_error "Failed to reload nginx container"
                return 1
            fi
        else
            log_error "Nginx configuration test failed"
            return 1
        fi
    fi
    
    # Try systemd service
    if systemctl is-active --quiet nginx 2>/dev/null; then
        log_info "Reloading nginx service..."
        
        if nginx -t 2>/dev/null; then
            if systemctl reload nginx; then
                log_info "Nginx service reloaded successfully"
                return 0
            else
                log_error "Failed to reload nginx service"
                return 1
            fi
        else
            log_error "Nginx configuration test failed"
            return 1
        fi
    fi
    
    # Try direct nginx command
    if command -v nginx &> /dev/null; then
        log_info "Reloading nginx directly..."
        
        if nginx -t 2>/dev/null; then
            if nginx -s reload 2>/dev/null; then
                log_info "Nginx reloaded successfully"
                return 0
            else
                log_error "Failed to reload nginx"
                return 1
            fi
        else
            log_error "Nginx configuration test failed"
            return 1
        fi
    fi
    
    log_warn "Could not find nginx to reload. Manual reload may be required."
    return 0
}

# Verify renewed certificates
verify_certificates() {
    log_step "Verifying renewed certificates..."
    
    local all_valid=true
    
    for cert_dir in "$CERT_PATH"/*/; do
        if [ -d "$cert_dir" ]; then
            local domain=$(basename "$cert_dir")
            local cert_file="$cert_dir/fullchain.pem"
            
            if [ -f "$cert_file" ]; then
                # Verify certificate is valid
                if openssl x509 -in "$cert_file" -noout -checkend 0 2>/dev/null; then
                    local expiry=$(openssl x509 -in "$cert_file" -noout -enddate 2>/dev/null | cut -d= -f2)
                    log_info "Certificate for $domain is valid (expires: $expiry)"
                else
                    log_error "Certificate for $domain is expired or invalid!"
                    all_valid=false
                fi
            fi
        fi
    done
    
    if [ "$all_valid" = true ]; then
        log_info "All certificates verified successfully"
        return 0
    else
        log_error "Some certificates failed verification"
        return 1
    fi
}

# Send notification on failure (optional)
send_notification() {
    local status="$1"
    local message="$2"
    
    # Check for Slack webhook
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -sf -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"SSL Renewal $status: $message\"}" \
            "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
    
    # Check for email notification
    if [ -n "$NOTIFICATION_EMAIL" ] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "SSL Renewal $status" "$NOTIFICATION_EMAIL" 2>/dev/null || true
    fi
}

# Main execution
main() {
    setup_logging
    
    log_info "=========================================="
    log_info "Starting SSL certificate renewal check"
    log_info "=========================================="
    
    check_certbot
    
    # Check current certificate status
    if ! check_expiration; then
        log_warn "No certificates to renew"
        exit 0
    fi
    
    # Attempt renewal
    if renew_certificates; then
        # Reload nginx if renewal was successful
        if reload_nginx; then
            # Verify certificates after reload
            if verify_certificates; then
                log_info "=========================================="
                log_info "SSL certificate renewal completed successfully"
                log_info "=========================================="
                send_notification "SUCCESS" "Certificates renewed and nginx reloaded"
                exit 0
            fi
        fi
    fi
    
    log_error "=========================================="
    log_error "SSL certificate renewal failed"
    log_error "=========================================="
    send_notification "FAILED" "Certificate renewal failed - manual intervention required"
    exit 1
}

main
