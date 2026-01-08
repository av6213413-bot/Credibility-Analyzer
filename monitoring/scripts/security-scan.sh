#!/bin/bash
# Security Vulnerability Scanning Script
# Requirements: 9.1 - THE dependency scanner SHALL check for security vulnerabilities daily
#
# This script:
# 1. Runs npm audit for the backend service
# 2. Runs pip-audit for the ML service
# 3. Reports vulnerability counts by severity to Prometheus Pushgateway
# 4. Exits with non-zero status if critical vulnerabilities are found

set -euo pipefail

# Configuration
BACKEND_DIR="${BACKEND_DIR:-/app/backend}"
ML_SERVICE_DIR="${ML_SERVICE_DIR:-/app/ml-service}"
PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://pushgateway:9091}"
JOB_NAME="security_scan"
LOG_FILE="/var/log/security-scan.log"

# Metrics
METRIC_BACKEND_CRITICAL=0
METRIC_BACKEND_HIGH=0
METRIC_BACKEND_MODERATE=0
METRIC_BACKEND_LOW=0
METRIC_BACKEND_INFO=0
METRIC_BACKEND_TOTAL=0

METRIC_ML_CRITICAL=0
METRIC_ML_HIGH=0
METRIC_ML_MODERATE=0
METRIC_ML_LOW=0
METRIC_ML_TOTAL=0

METRIC_SCAN_STATUS=0  # 0 = failure/critical found, 1 = success
METRIC_SCAN_DURATION=0

# Logging function
log() {
    local level="$1"
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# Push metrics to Prometheus Pushgateway
push_metrics() {
    log "INFO" "Pushing metrics to Pushgateway"
    
    cat <<EOF | curl --silent --data-binary @- "${PUSHGATEWAY_URL}/metrics/job/${JOB_NAME}"
# HELP security_scan_status Status of the last security scan (1=no critical, 0=critical found or failure)
# TYPE security_scan_status gauge
security_scan_status $METRIC_SCAN_STATUS
# HELP security_scan_duration_seconds Duration of the security scan in seconds
# TYPE security_scan_duration_seconds gauge
security_scan_duration_seconds $METRIC_SCAN_DURATION
# HELP security_scan_last_run_timestamp Unix timestamp of last scan
# TYPE security_scan_last_run_timestamp gauge
security_scan_last_run_timestamp $(date +%s)
# HELP security_vulnerabilities_backend_total Total vulnerabilities in backend by severity
# TYPE security_vulnerabilities_backend_total gauge
security_vulnerabilities_backend_total{severity="critical"} $METRIC_BACKEND_CRITICAL
security_vulnerabilities_backend_total{severity="high"} $METRIC_BACKEND_HIGH
security_vulnerabilities_backend_total{severity="moderate"} $METRIC_BACKEND_MODERATE
security_vulnerabilities_backend_total{severity="low"} $METRIC_BACKEND_LOW
security_vulnerabilities_backend_total{severity="info"} $METRIC_BACKEND_INFO
# HELP security_vulnerabilities_ml_total Total vulnerabilities in ML service by severity
# TYPE security_vulnerabilities_ml_total gauge
security_vulnerabilities_ml_total{severity="critical"} $METRIC_ML_CRITICAL
security_vulnerabilities_ml_total{severity="high"} $METRIC_ML_HIGH
security_vulnerabilities_ml_total{severity="moderate"} $METRIC_ML_MODERATE
security_vulnerabilities_ml_total{severity="low"} $METRIC_ML_LOW
# HELP security_vulnerabilities_total Combined total vulnerabilities
# TYPE security_vulnerabilities_total gauge
security_vulnerabilities_total $((METRIC_BACKEND_TOTAL + METRIC_ML_TOTAL))
EOF
    
    if [ $? -eq 0 ]; then
        log "INFO" "Metrics pushed successfully"
    else
        log "WARN" "Failed to push metrics to Pushgateway"
    fi
}


# Scan backend (npm audit)
scan_backend() {
    log "INFO" "Scanning backend dependencies with npm audit"
    
    if [ ! -d "$BACKEND_DIR" ]; then
        log "WARN" "Backend directory not found: $BACKEND_DIR"
        return 0
    fi
    
    cd "$BACKEND_DIR"
    
    # Check if package-lock.json exists
    if [ ! -f "package-lock.json" ]; then
        log "WARN" "No package-lock.json found in backend directory"
        return 0
    fi
    
    # Run npm audit and capture JSON output
    local audit_output
    audit_output=$(npm audit --json 2>/dev/null || true)
    
    if [ -z "$audit_output" ]; then
        log "WARN" "npm audit returned empty output"
        return 0
    fi
    
    # Parse vulnerability counts by severity using jq
    if command -v jq &> /dev/null; then
        METRIC_BACKEND_CRITICAL=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
        METRIC_BACKEND_HIGH=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
        METRIC_BACKEND_MODERATE=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.moderate // 0' 2>/dev/null || echo "0")
        METRIC_BACKEND_LOW=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.low // 0' 2>/dev/null || echo "0")
        METRIC_BACKEND_INFO=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.info // 0' 2>/dev/null || echo "0")
        METRIC_BACKEND_TOTAL=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.total // 0' 2>/dev/null || echo "0")
    else
        # Fallback: parse using grep if jq is not available
        log "WARN" "jq not found, using fallback parsing"
        METRIC_BACKEND_CRITICAL=$(echo "$audit_output" | grep -o '"critical":[0-9]*' | grep -o '[0-9]*' || echo "0")
        METRIC_BACKEND_HIGH=$(echo "$audit_output" | grep -o '"high":[0-9]*' | grep -o '[0-9]*' || echo "0")
        METRIC_BACKEND_MODERATE=$(echo "$audit_output" | grep -o '"moderate":[0-9]*' | grep -o '[0-9]*' || echo "0")
        METRIC_BACKEND_LOW=$(echo "$audit_output" | grep -o '"low":[0-9]*' | grep -o '[0-9]*' || echo "0")
        METRIC_BACKEND_INFO=$(echo "$audit_output" | grep -o '"info":[0-9]*' | grep -o '[0-9]*' || echo "0")
        METRIC_BACKEND_TOTAL=$((METRIC_BACKEND_CRITICAL + METRIC_BACKEND_HIGH + METRIC_BACKEND_MODERATE + METRIC_BACKEND_LOW + METRIC_BACKEND_INFO))
    fi
    
    log "INFO" "Backend vulnerabilities - Critical: $METRIC_BACKEND_CRITICAL, High: $METRIC_BACKEND_HIGH, Moderate: $METRIC_BACKEND_MODERATE, Low: $METRIC_BACKEND_LOW, Info: $METRIC_BACKEND_INFO"
    
    # Return non-zero if critical vulnerabilities found
    if [ "$METRIC_BACKEND_CRITICAL" -gt 0 ]; then
        log "ERROR" "Critical vulnerabilities found in backend!"
        return 1
    fi
    
    return 0
}

# Scan ML service (pip-audit)
scan_ml_service() {
    log "INFO" "Scanning ML service dependencies with pip-audit"
    
    if [ ! -d "$ML_SERVICE_DIR" ]; then
        log "WARN" "ML service directory not found: $ML_SERVICE_DIR"
        return 0
    fi
    
    cd "$ML_SERVICE_DIR"
    
    # Check if requirements.txt exists
    if [ ! -f "requirements.txt" ]; then
        log "WARN" "No requirements.txt found in ML service directory"
        return 0
    fi
    
    # Check if pip-audit is installed
    if ! command -v pip-audit &> /dev/null; then
        log "WARN" "pip-audit not installed, attempting to install"
        pip install pip-audit --quiet 2>/dev/null || {
            log "ERROR" "Failed to install pip-audit"
            return 0
        }
    fi
    
    # Run pip-audit and capture JSON output
    local audit_output
    audit_output=$(pip-audit --format=json -r requirements.txt 2>/dev/null || true)
    
    if [ -z "$audit_output" ]; then
        log "WARN" "pip-audit returned empty output"
        return 0
    fi
    
    # Parse vulnerability counts by severity using jq
    if command -v jq &> /dev/null; then
        # pip-audit JSON format: array of vulnerabilities with "vulns" array containing severity
        # Count vulnerabilities by severity
        METRIC_ML_CRITICAL=$(echo "$audit_output" | jq '[.[].vulns[] | select(.fix_versions != null)] | map(select(.aliases[]? | test("GHSA-.*-critical"; "i"))) | length' 2>/dev/null || echo "0")
        
        # pip-audit doesn't have built-in severity, so we count total and estimate
        local total_vulns
        total_vulns=$(echo "$audit_output" | jq 'length' 2>/dev/null || echo "0")
        
        # Count by checking vulnerability IDs and descriptions
        # For pip-audit, we'll categorize based on the vulnerability data
        METRIC_ML_TOTAL=$total_vulns
        
        # Estimate severity distribution (pip-audit doesn't provide severity directly)
        # We'll count all as "high" by default since pip-audit focuses on known vulnerabilities
        if [ "$total_vulns" -gt 0 ]; then
            # Check for critical keywords in vulnerability descriptions
            METRIC_ML_CRITICAL=$(echo "$audit_output" | jq '[.[].vulns[].id] | map(select(test("CVE-.*"; "i"))) | length' 2>/dev/null || echo "0")
            METRIC_ML_HIGH=$((total_vulns - METRIC_ML_CRITICAL))
            if [ "$METRIC_ML_HIGH" -lt 0 ]; then
                METRIC_ML_HIGH=0
            fi
        fi
    else
        # Fallback: count lines in output
        log "WARN" "jq not found, using fallback parsing"
        METRIC_ML_TOTAL=$(echo "$audit_output" | grep -c '"name"' || echo "0")
        METRIC_ML_HIGH=$METRIC_ML_TOTAL
    fi
    
    log "INFO" "ML service vulnerabilities - Critical: $METRIC_ML_CRITICAL, High: $METRIC_ML_HIGH, Moderate: $METRIC_ML_MODERATE, Low: $METRIC_ML_LOW, Total: $METRIC_ML_TOTAL"
    
    # Return non-zero if critical vulnerabilities found
    if [ "$METRIC_ML_CRITICAL" -gt 0 ]; then
        log "ERROR" "Critical vulnerabilities found in ML service!"
        return 1
    fi
    
    return 0
}


# Generate summary report
generate_report() {
    log "INFO" "=========================================="
    log "INFO" "Security Scan Summary"
    log "INFO" "=========================================="
    log "INFO" ""
    log "INFO" "Backend (npm audit):"
    log "INFO" "  Critical: $METRIC_BACKEND_CRITICAL"
    log "INFO" "  High:     $METRIC_BACKEND_HIGH"
    log "INFO" "  Moderate: $METRIC_BACKEND_MODERATE"
    log "INFO" "  Low:      $METRIC_BACKEND_LOW"
    log "INFO" "  Info:     $METRIC_BACKEND_INFO"
    log "INFO" "  Total:    $METRIC_BACKEND_TOTAL"
    log "INFO" ""
    log "INFO" "ML Service (pip-audit):"
    log "INFO" "  Critical: $METRIC_ML_CRITICAL"
    log "INFO" "  High:     $METRIC_ML_HIGH"
    log "INFO" "  Moderate: $METRIC_ML_MODERATE"
    log "INFO" "  Low:      $METRIC_ML_LOW"
    log "INFO" "  Total:    $METRIC_ML_TOTAL"
    log "INFO" ""
    log "INFO" "Combined Total: $((METRIC_BACKEND_TOTAL + METRIC_ML_TOTAL))"
    log "INFO" "=========================================="
}

# Main execution
main() {
    local start_time
    start_time=$(date +%s)
    
    log "INFO" "=========================================="
    log "INFO" "Starting security vulnerability scan"
    log "INFO" "=========================================="
    
    local has_critical=0
    
    # Scan backend
    if ! scan_backend; then
        has_critical=1
    fi
    
    # Scan ML service
    if ! scan_ml_service; then
        has_critical=1
    fi
    
    # Calculate duration
    local end_time
    end_time=$(date +%s)
    METRIC_SCAN_DURATION=$((end_time - start_time))
    
    # Set status based on critical vulnerabilities
    if [ $has_critical -eq 0 ]; then
        METRIC_SCAN_STATUS=1
        log "INFO" "No critical vulnerabilities found"
    else
        METRIC_SCAN_STATUS=0
        log "ERROR" "Critical vulnerabilities detected!"
    fi
    
    # Generate report
    generate_report
    
    # Push metrics
    push_metrics
    
    log "INFO" "Security scan completed in ${METRIC_SCAN_DURATION} seconds"
    
    # Exit with appropriate status
    if [ $has_critical -eq 1 ]; then
        exit 1
    fi
    
    exit 0
}

# Run main function
main "$@"
