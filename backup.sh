#!/usr/bin/env bash
echo "CAVRIX Panel - Backup Script"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/manual"
mkdir -p "$BACKUP_DIR"
tar -czf "${BACKUP_DIR}/cavrix-backup-${DATE}.tar.gz" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='frontend/dist' \
  --exclude='backend/dist' \
  --exclude='backups' \
  .
echo "Backup created: ${BACKUP_DIR}/cavrix-backup-${DATE}.tar.gz"
