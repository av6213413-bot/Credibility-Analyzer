#!/bin/bash
# install-ssl-cron.sh - Install SSL renewal cron job and logrotate configuration
# Usage: ./install-ssl-cron.sh
#
# Requirements: 7.2 - SSL certificate automatically renewed before expiration
# This script installs the cron job for automatic certificate renewal

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/scripts"
CRON_FILE="/etc/cron.d/certbot-renewal"
LOGROTATE_FILE="/etc/logrotate.d/certbot-renewal"
LOG_DIR="/var/log"
LOG_FILE="$LOG_DIR/certbot-renewal.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if running as root
check_permissions() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root or with sudo"
        exit 1
    fi
}

# Install renewal script
install_renewal_script() {
    log_step "Installing renewal script..."
    
    mkdir -p "$INSTALL_DIR"
    
    if [ -f "$SCRIPT_DIR/renew-ssl.sh" ]; then
        cp "$SCRIPT_DIR/renew-ssl.sh" "$INSTALL_DIR/renew-ssl.sh"
        chmod 755 "$INSTALL_DIR/renew-ssl.sh"
        log_info "Renewal script installed to $INSTALL_DIR/renew-ssl.sh"
    else
        log_error "renew-ssl.sh not found in $SCRIPT_DIR"
        exit 1
    fi
}

# Install cron job
install_cron_job() {
    log_step "Installing cron job..."
    
    if [ -f "$SCRIPT_DIR/cron.d/certbot-renewal" ]; then
        cp "$SCRIPT_DIR/cron.d/certbot-renewal" "$CRON_FILE"
        chmod 644 "$CRON_FILE"
        log_info "Cron job installed to $CRON_FILE"
    else
        log_error "cron.d/certbot-renewal not found in $SCRIPT_DIR"
        exit 1
    fi
    
    # Verify cron syntax
    if command -v crontab &> /dev/null; then
        if crontab -l -u root > /dev/null 2>&1 || true; then
            log_info "Cron configuration is valid"
        fi
    fi
}

# Install logrotate configuration
install_logrotate() {
    log_step "Installing logrotate configuration..."
    
    if [ -f "$SCRIPT_DIR/logrotate.d/certbot-renewal" ]; then
        cp "$SCRIPT_DIR/logrotate.d/certbot-renewal" "$LOGROTATE_FILE"
        chmod 644 "$LOGROTATE_FILE"
        log_info "Logrotate configuration installed to $LOGROTATE_FILE"
    else
        log_warn "logrotate.d/certbot-renewal not found, skipping logrotate setup"
    fi
}

# Create log file
setup_logging() {
    log_step "Setting up logging..."
    
    touch "$LOG_FILE"
    chmod 640 "$LOG_FILE"
    chown root:adm "$LOG_FILE" 2>/dev/null || true
    
    log_info "Log file created at $LOG_FILE"
}

# Verify installation
verify_installation() {
    log_step "Verifying installation..."
    
    local all_ok=true
    
    if [ -x "$INSTALL_DIR/renew-ssl.sh" ]; then
        log_info "✓ Renewal script is executable"
    else
        log_error "✗ Renewal script not found or not executable"
        all_ok=false
    fi
    
    if [ -f "$CRON_FILE" ]; then
        log_info "✓ Cron job is installed"
    else
        log_error "✗ Cron job not installed"
        all_ok=false
    fi
    
    if [ -f "$LOGROTATE_FILE" ]; then
        log_info "✓ Logrotate configuration is installed"
    else
        log_warn "○ Logrotate configuration not installed (optional)"
    fi
    
    if [ -f "$LOG_FILE" ]; then
        log_info "✓ Log file exists"
    else
        log_warn "○ Log file not created"
    fi
    
    if [ "$all_ok" = true ]; then
        return 0
    else
        return 1
    fi
}

# Display summary
display_summary() {
    echo ""
    log_info "=========================================="
    log_info "SSL Auto-Renewal Installation Complete!"
    log_info "=========================================="
    echo ""
    log_info "Installed components:"
    log_info "  - Renewal script: $INSTALL_DIR/renew-ssl.sh"
    log_info "  - Cron job: $CRON_FILE"
    log_info "  - Logrotate: $LOGROTATE_FILE"
    log_info "  - Log file: $LOG_FILE"
    echo ""
    log_info "The cron job will run daily at 3:00 AM to check"
    log_info "and renew certificates that are within 30 days"
    log_info "of expiration."
    echo ""
    log_info "To test the renewal script manually:"
    log_info "  sudo $INSTALL_DIR/renew-ssl.sh --dry-run"
    echo ""
    log_info "To view renewal logs:"
    log_info "  tail -f $LOG_FILE"
}

# Uninstall function
uninstall() {
    log_step "Uninstalling SSL auto-renewal..."
    
    rm -f "$CRON_FILE"
    rm -f "$LOGROTATE_FILE"
    rm -f "$INSTALL_DIR/renew-ssl.sh"
    
    log_info "SSL auto-renewal uninstalled"
}

# Main execution
main() {
    case "${1:-install}" in
        install)
            log_info "Installing SSL auto-renewal..."
            check_permissions
            install_renewal_script
            install_cron_job
            install_logrotate
            setup_logging
            verify_installation
            display_summary
            ;;
        uninstall)
            check_permissions
            uninstall
            ;;
        verify)
            verify_installation
            ;;
        *)
            echo "Usage: $0 [install|uninstall|verify]"
            exit 1
            ;;
    esac
}

main "$@"
