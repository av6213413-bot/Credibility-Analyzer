#!/bin/bash
# MongoDB Backup Verification Script
# Requirements: 8.2 - THE backup verification script SHALL run weekly to test backup integrity
#
# This script:
# 1. Finds the latest MongoDB backup
# 2. Restores it to a temporary database
# 3. Verifies data integrity
# 4. Reports success/failure to Prometheus Pushgateway
# 5. Cleans up temporary resources

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/mongodb}"
MONGO_HOST="${MONGO_HOST:-mongodb}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_USER="${MONGO_USER:-}"
MONGO_PASSWORD="${MONGO_PASSWORD:-}"
TEMP_DB_NAME="backup_verification_temp_$(date +%s)"
PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://pushgateway:9091}"
JOB_NAME="backup_verification"
LOG_FILE="/var/log/backup-verify.log"

# Metrics
METRIC_STATUS=0  # 0 = failure, 1 = success
METRIC_DURATION=0
METRIC_BACKUP_AGE_HOURS=0
METRIC_BACKUP_SIZE_BYTES=0

# Logging function
log() {
    local level="$1"
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# Cleanup function
cleanup() {
    log "INFO" "Cleaning up temporary database: $TEMP_DB_NAME"
    
    local mongo_cmd="mongosh"
    if [ -n "$MONGO_USER" ] && [ -n "$MONGO_PASSWORD" ]; then
        mongo_cmd="mongosh --host $MONGO_HOST --port $MONGO_PORT -u $MONGO_USER -p $MONGO_PASSWORD --authenticationDatabase admin"
    else
        mongo_cmd="mongosh --host $MONGO_HOST --port $MONGO_PORT"
    fi
    
    $mongo_cmd --eval "db.getSiblingDB('$TEMP_DB_NAME').dropDatabase()" --quiet 2>/dev/null || true
    
    log "INFO" "Cleanup completed"
}

# Push metrics to Prometheus Pushgateway
push_metrics() {
    log "INFO" "Pushing metrics to Pushgateway"
    
    cat <<EOF | curl --silent --data-binary @- "${PUSHGATEWAY_URL}/metrics/job/${JOB_NAME}"
# HELP backup_verification_status Status of the last backup verification (1=success, 0=failure)
# TYPE backup_verification_status gauge
backup_verification_status $METRIC_STATUS
# HELP backup_verification_duration_seconds Duration of the backup verification in seconds
# TYPE backup_verification_duration_seconds gauge
backup_verification_duration_seconds $METRIC_DURATION
# HELP backup_verification_backup_age_hours Age of the verified backup in hours
# TYPE backup_verification_backup_age_hours gauge
backup_verification_backup_age_hours $METRIC_BACKUP_AGE_HOURS
# HELP backup_verification_backup_size_bytes Size of the verified backup in bytes
# TYPE backup_verification_backup_size_bytes gauge
backup_verification_backup_size_bytes $METRIC_BACKUP_SIZE_BYTES
# HELP backup_verification_last_success_timestamp Unix timestamp of last successful verification
# TYPE backup_verification_last_success_timestamp gauge
backup_verification_last_success_timestamp $(date +%s)
EOF
    
    if [ $? -eq 0 ]; then
        log "INFO" "Metrics pushed successfully"
    else
        log "WARN" "Failed to push metrics to Pushgateway"
    fi
}

# Find the latest backup
find_latest_backup() {
    log "INFO" "Searching for latest backup in $BACKUP_DIR"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log "ERROR" "Backup directory does not exist: $BACKUP_DIR"
        return 1
    fi
    
    # Find the most recent backup (supports both .gz and .archive formats)
    local latest_backup
    latest_backup=$(find "$BACKUP_DIR" -type f \( -name "*.gz" -o -name "*.archive" -o -name "*.bson" \) -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
    
    if [ -z "$latest_backup" ]; then
        log "ERROR" "No backup files found in $BACKUP_DIR"
        return 1
    fi
    
    # Calculate backup age
    local backup_timestamp
    backup_timestamp=$(stat -c %Y "$latest_backup")
    local current_timestamp
    current_timestamp=$(date +%s)
    METRIC_BACKUP_AGE_HOURS=$(( (current_timestamp - backup_timestamp) / 3600 ))
    
    # Get backup size
    METRIC_BACKUP_SIZE_BYTES=$(stat -c %s "$latest_backup")
    
    log "INFO" "Found latest backup: $latest_backup"
    log "INFO" "Backup age: ${METRIC_BACKUP_AGE_HOURS} hours"
    log "INFO" "Backup size: ${METRIC_BACKUP_SIZE_BYTES} bytes"
    
    echo "$latest_backup"
}

# Restore backup to temporary database
restore_backup() {
    local backup_file="$1"
    log "INFO" "Restoring backup to temporary database: $TEMP_DB_NAME"
    
    local restore_cmd="mongorestore"
    local auth_args=""
    
    if [ -n "$MONGO_USER" ] && [ -n "$MONGO_PASSWORD" ]; then
        auth_args="--host $MONGO_HOST --port $MONGO_PORT -u $MONGO_USER -p $MONGO_PASSWORD --authenticationDatabase admin"
    else
        auth_args="--host $MONGO_HOST --port $MONGO_PORT"
    fi
    
    # Determine restore method based on file type
    if [[ "$backup_file" == *.gz ]]; then
        # Compressed archive
        $restore_cmd $auth_args --gzip --archive="$backup_file" --nsFrom='*.*' --nsTo="${TEMP_DB_NAME}.*" 2>&1 | tee -a "$LOG_FILE"
    elif [[ "$backup_file" == *.archive ]]; then
        # Uncompressed archive
        $restore_cmd $auth_args --archive="$backup_file" --nsFrom='*.*' --nsTo="${TEMP_DB_NAME}.*" 2>&1 | tee -a "$LOG_FILE"
    else
        # Directory-based backup
        local backup_dir
        backup_dir=$(dirname "$backup_file")
        $restore_cmd $auth_args --db "$TEMP_DB_NAME" "$backup_dir" 2>&1 | tee -a "$LOG_FILE"
    fi
    
    if [ $? -ne 0 ]; then
        log "ERROR" "Failed to restore backup"
        return 1
    fi
    
    log "INFO" "Backup restored successfully"
}


# Verify restored data integrity
verify_data() {
    log "INFO" "Verifying data integrity in temporary database"
    
    local mongo_cmd="mongosh"
    if [ -n "$MONGO_USER" ] && [ -n "$MONGO_PASSWORD" ]; then
        mongo_cmd="mongosh --host $MONGO_HOST --port $MONGO_PORT -u $MONGO_USER -p $MONGO_PASSWORD --authenticationDatabase admin"
    else
        mongo_cmd="mongosh --host $MONGO_HOST --port $MONGO_PORT"
    fi
    
    # Check if database exists and has collections
    local collections_count
    collections_count=$($mongo_cmd --eval "db.getSiblingDB('$TEMP_DB_NAME').getCollectionNames().length" --quiet 2>/dev/null)
    
    if [ -z "$collections_count" ] || [ "$collections_count" -eq 0 ]; then
        log "ERROR" "No collections found in restored database"
        return 1
    fi
    
    log "INFO" "Found $collections_count collections in restored database"
    
    # Verify each collection has documents and can be queried
    local verification_script="
        const db = db.getSiblingDB('$TEMP_DB_NAME');
        const collections = db.getCollectionNames();
        let totalDocs = 0;
        let errors = [];
        
        collections.forEach(function(collName) {
            try {
                const count = db.getCollection(collName).countDocuments();
                totalDocs += count;
                print('Collection ' + collName + ': ' + count + ' documents');
                
                // Try to read a sample document to verify data integrity
                const sample = db.getCollection(collName).findOne();
                if (count > 0 && !sample) {
                    errors.push('Failed to read from collection: ' + collName);
                }
            } catch (e) {
                errors.push('Error checking collection ' + collName + ': ' + e.message);
            }
        });
        
        print('Total documents: ' + totalDocs);
        
        if (errors.length > 0) {
            print('ERRORS:');
            errors.forEach(function(e) { print('  - ' + e); });
            quit(1);
        }
        
        if (totalDocs === 0) {
            print('WARNING: No documents found in any collection');
        }
        
        print('Verification completed successfully');
    "
    
    $mongo_cmd --eval "$verification_script" 2>&1 | tee -a "$LOG_FILE"
    
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        log "ERROR" "Data verification failed"
        return 1
    fi
    
    log "INFO" "Data integrity verification passed"
}

# Main execution
main() {
    local start_time
    start_time=$(date +%s)
    
    log "INFO" "=========================================="
    log "INFO" "Starting MongoDB backup verification"
    log "INFO" "=========================================="
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Find latest backup
    local backup_file
    backup_file=$(find_latest_backup)
    if [ $? -ne 0 ] || [ -z "$backup_file" ]; then
        log "ERROR" "Failed to find backup file"
        METRIC_STATUS=0
        push_metrics
        exit 1
    fi
    
    # Restore backup
    if ! restore_backup "$backup_file"; then
        log "ERROR" "Backup restoration failed"
        METRIC_STATUS=0
        push_metrics
        exit 1
    fi
    
    # Verify data
    if ! verify_data; then
        log "ERROR" "Data verification failed"
        METRIC_STATUS=0
        push_metrics
        exit 1
    fi
    
    # Calculate duration
    local end_time
    end_time=$(date +%s)
    METRIC_DURATION=$((end_time - start_time))
    
    # Success
    METRIC_STATUS=1
    log "INFO" "=========================================="
    log "INFO" "Backup verification completed successfully"
    log "INFO" "Duration: ${METRIC_DURATION} seconds"
    log "INFO" "=========================================="
    
    push_metrics
    exit 0
}

# Run main function
main "$@"
