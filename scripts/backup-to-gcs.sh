#!/bin/bash
# Pet Wash™ - Weekly Code Backup to Google Cloud Storage
# 
# This script creates a complete backup of the Pet Wash codebase
# and uploads it to Google Cloud Storage
#
# Prerequisites:
# 1. Google Cloud SDK installed (gsutil command available)
# 2. Authenticated with: gcloud auth login
# 3. GCS bucket created: gs://petwash-code-backups/
#
# Usage:
#   ./scripts/backup-to-gcs.sh
#   or schedule in cron: 0 2 * * 0 /path/to/backup-to-gcs.sh  # Every Sunday at 2 AM

set -e  # Exit on error

# Configuration
PROJECT_NAME="petwash"
BACKUP_DIR="/tmp/petwash-backups"
GCS_BUCKET="gs://petwash-code-backups"
DATE=$(date +%Y-%m-%d)
BACKUP_FILE="${PROJECT_NAME}-code-${DATE}.tar.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Starting Pet Wash™ Code Backup${NC}"
echo "Date: ${DATE}"
echo "Backup file: ${BACKUP_FILE}"

# Check if gsutil is installed
if ! command -v gsutil &> /dev/null; then
    echo -e "${RED}❌ Error: gsutil not found${NC}"
    echo "Please install Google Cloud SDK:"
    echo "  curl https://sdk.cloud.google.com | bash"
    exit 1
fi

# Check if authenticated
if ! gsutil ls ${GCS_BUCKET} &> /dev/null; then
    echo -e "${RED}❌ Error: Cannot access GCS bucket${NC}"
    echo "Please authenticate with: gcloud auth login"
    echo "And ensure bucket exists: gsutil mb ${GCS_BUCKET}"
    exit 1
fi

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Create compressed backup (exclude node_modules, .git, dist, logs)
echo -e "${YELLOW}📦 Creating compressed backup...${NC}"
tar -czf "${BACKUP_DIR}/${BACKUP_FILE}" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='.cache' \
  --exclude='*.log' \
  --exclude='petwash-backup-*.tar.gz' \
  -C /home/runner/workspace .

# Get backup size
BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
echo -e "${GREEN}✅ Backup created: ${BACKUP_SIZE}${NC}"

# Upload to Google Cloud Storage
echo -e "${YELLOW}☁️  Uploading to Google Cloud Storage...${NC}"
gsutil cp "${BACKUP_DIR}/${BACKUP_FILE}" "${GCS_BUCKET}/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully uploaded to ${GCS_BUCKET}/${BACKUP_FILE}${NC}"
    
    # Set metadata
    gsutil setmeta \
      -h "x-goog-meta-project:pet-wash" \
      -h "x-goog-meta-type:code-backup" \
      -h "x-goog-meta-date:${DATE}" \
      "${GCS_BUCKET}/${BACKUP_FILE}"
    
    # List recent backups
    echo -e "\n${GREEN}📋 Recent backups in GCS:${NC}"
    gsutil ls -lh "${GCS_BUCKET}/" | grep "${PROJECT_NAME}-code" | tail -5
    
    # Clean up local backup
    rm "${BACKUP_DIR}/${BACKUP_FILE}"
    echo -e "${GREEN}🗑️  Local backup cleaned up${NC}"
    
    # Optional: Clean old backups (keep last 12 weeks)
    echo -e "\n${YELLOW}🧹 Cleaning old backups (keeping last 12 weeks)...${NC}"
    CUTOFF_DATE=$(date -d "12 weeks ago" +%Y-%m-%d)
    gsutil ls "${GCS_BUCKET}/${PROJECT_NAME}-code-*.tar.gz" | while read file; do
        FILE_DATE=$(echo $file | grep -oP '\d{4}-\d{2}-\d{2}')
        if [[ "$FILE_DATE" < "$CUTOFF_DATE" ]]; then
            echo "Deleting old backup: $file"
            gsutil rm "$file"
        fi
    done
    
    echo -e "\n${GREEN}✨ Backup complete!${NC}"
    exit 0
else
    echo -e "${RED}❌ Upload failed${NC}"
    exit 1
fi
