#!/usr/bin/env bash
echo "CAVRIX Panel - Restore Script"
echo "Usage: bash restore.sh <backup-file.tar.gz>"
if [ -z "$1" ]; then
  echo "Please provide a backup file path."
  exit 1
fi
if [ ! -f "$1" ]; then
  echo "Backup file not found: $1"
  exit 1
fi
echo "Restoring from: $1"
tar -xzf "$1" -C .
echo "Restore complete. Restart the panel to apply changes."
