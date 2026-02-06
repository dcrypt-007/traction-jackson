#!/bin/bash
# TractionJackson Status Check
# Location: /opt/tj-status.sh
# Usage: /opt/tj-status.sh

# Configuration
ENV_FILE="/opt/tj.env"
LOG_DIR="/var/log/traction-jackson"
PID_DIR="/var/run/traction-jackson"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load env for port info
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

TJ_PORT="${TJ_PORT:-3000}"
OAUTH_PORT="${OAUTH_PORT:-3333}"
PUBLIC_URL="${PUBLIC_BASE_URL:-http://localhost}"

echo ""
echo "=========================================="
echo "   TractionJackson Status"
echo "=========================================="
echo ""

# Check main server
if pgrep -f "node server.js" > /dev/null; then
    PID=$(pgrep -f "node server.js" | head -1)
    echo -e "${GREEN}✓ Main Server${NC}"
    echo "  Status: RUNNING (PID: $PID)"
    echo "  Port:   $TJ_PORT"
    echo "  URL:    ${PUBLIC_URL}:${TJ_PORT}"
else
    echo -e "${RED}✗ Main Server${NC}"
    echo "  Status: STOPPED"
fi

echo ""

# Check OAuth server
if pgrep -f "node canva-oauth-server.js" > /dev/null; then
    PID=$(pgrep -f "node canva-oauth-server.js" | head -1)
    echo -e "${GREEN}✓ OAuth Server${NC}"
    echo "  Status: RUNNING (PID: $PID)"
    echo "  Port:   $OAUTH_PORT"
    echo "  URL:    ${PUBLIC_URL}:${OAUTH_PORT}/connect"
else
    echo -e "${RED}✗ OAuth Server${NC}"
    echo "  Status: STOPPED"
fi

echo ""
echo "=========================================="
echo "   API Health"
echo "=========================================="
echo ""

# Try to hit the status endpoint
STATUS=$(curl -s "http://localhost:${TJ_PORT}/api/status" 2>/dev/null)
if [ -n "$STATUS" ]; then
    CANVA_CONNECTED=$(echo "$STATUS" | grep -o '"canva":[^,}]*' | grep -o 'true\|false' | head -1)
    echo "API Response: OK"
    echo "Canva Connected: $CANVA_CONNECTED"

    if [ "$CANVA_CONNECTED" = "false" ]; then
        echo ""
        echo -e "${YELLOW}To connect Canva:${NC}"
        echo "Visit: ${PUBLIC_URL}:${OAUTH_PORT}/connect"
    fi
else
    echo -e "${RED}API not responding${NC}"
fi

echo ""
echo "=========================================="
echo "   Logs"
echo "=========================================="
echo ""
echo "Server log:  $LOG_DIR/server.log"
echo "OAuth log:   $LOG_DIR/oauth.log"
echo ""
echo "View recent: tail -20 $LOG_DIR/server.log"
echo ""
