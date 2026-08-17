#!/usr/bin/env bash

echo "CAVRIX Panel - Uninstall"
echo ""

read -r -p "Are you sure you want to uninstall CAVRIX Panel? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Uninstall cancelled."
    exit 0
fi

pm2 stop cavrix-panel 2>/dev/null || true
pm2 delete cavrix-panel 2>/dev/null || true

read -r -p "Remove all server data and backups? (y/N): " remove_data
if [[ "$remove_data" =~ ^[Yy]$ ]]; then
    rm -rf .data backups
    echo "Data removed."
else
    echo "Data preserved in .data/ and backups/"
fi

echo "CAVRIX Panel uninstalled. Binary files and configuration preserved."
