#!/bin/bash
# TractionJackson Restart
# Location: /opt/tj-restart.sh
# Usage: /opt/tj-restart.sh

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo ""
echo "Restarting TractionJackson..."
echo ""

# Stop processes gracefully
echo "Stopping services..."

if pgrep -f "node server.js" > /dev/null; then
    pkill -f "node server.js"
    echo "  Main server stopped"
else
    echo "  Main server was not running"
fi

if pgrep -f "node canva-oauth-server.js" > /dev/null; then
    pkill -f "node canva-oauth-server.js"
    echo "  OAuth server stopped"
else
    echo "  OAuth server was not running"
fi

# Wait for clean shutdown
sleep 2

# Start via the dev script
echo ""
echo "Starting services..."
/opt/tj-dev.sh
