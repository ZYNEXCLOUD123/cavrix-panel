#!/usr/bin/env bash

echo "CAVRIX Panel - Updating..."
echo ""

if [ -d ".git" ]; then
    git pull origin main
fi

npm install --no-audit --no-fund
cd frontend && npm install --no-audit --no-fund && npm run build && cd ..
cd backend && npm install --no-audit --no-fund && npm run build && cd ..

pm2 restart cavrix-panel 2>/dev/null || true

echo "CAVRIX Panel updated successfully."
