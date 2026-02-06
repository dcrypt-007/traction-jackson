#!/bin/bash
# TractionJackson Development Server Startup
# Location: /opt/tj-dev.sh
# Usage: /opt/tj-dev.sh

set -e

# Configuration
TJ_DIR="/home/openclaw/traction-jackson"
ENV_FILE="/opt/tj.env"
LOG_DIR="/var/log/traction-jackson"
PID_DIR="/var/run/traction-jackson"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "   TractionJackson Development Server"
echo "=========================================="
echo ""

# Check env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}ERROR: $ENV_FILE not found${NC}"
    echo "Copy /home/openclaw/traction-jackson/deploy/tj.env.template to $ENV_FILE"
    echo "and fill in your secrets."
    exit 1
fi

# Load environment variables (without exposing secrets)
set -a
source "$ENV_FILE"
set +a

# Validate required vars
if [ -z "$ADMIN_SECRET" ]; then
    echo -e "${RED}ERROR: ADMIN_SECRET not set in $ENV_FILE${NC}"
    echo "Generate one with: openssl rand -hex 32"
    exit 1
fi

if [ -z "$PUBLIC_BASE_URL" ]; then
    echo -e "${RED}ERROR: PUBLIC_BASE_URL not set in $ENV_FILE${NC}"
    echo "Set it to your droplet IP, e.g.: http://159.65.123.45"
    exit 1
fi

if [ -z "$CANVA_CLIENT_SECRET" ]; then
    echo -e "${YELLOW}WARNING: CANVA_CLIENT_SECRET not set - token refresh won't work${NC}"
fi

# Create directories
mkdir -p "$LOG_DIR" "$PID_DIR"

# Check repo exists
if [ ! -d "$TJ_DIR" ]; then
    echo -e "${RED}ERROR: TractionJackson repo not found at $TJ_DIR${NC}"
    echo "Clone it with: git clone https://github.com/your-org/traction-jackson.git $TJ_DIR"
    exit 1
fi

cd "$TJ_DIR"

# Stop any existing processes
echo "Stopping existing processes..."
pkill -f "node server.js" 2>/dev/null || true
pkill -f "node canva-oauth-server.js" 2>/dev/null || true
sleep 1

# Export port variables for the servers
export PORT="${TJ_PORT:-3000}"
export CANVA_OAUTH_PORT="${OAUTH_PORT:-3333}"

# Start OAuth server (needed for Canva connection)
echo "Starting OAuth server on port $CANVA_OAUTH_PORT..."
nohup node canva-oauth-server.js > "$LOG_DIR/oauth.log" 2>&1 &
echo $! > "$PID_DIR/oauth.pid"

# Wait a moment for OAuth server
sleep 1

# Start main TJ server
echo "Starting TractionJackson on port $PORT..."
nohup node server.js > "$LOG_DIR/server.log" 2>&1 &
echo $! > "$PID_DIR/server.pid"

# Wait for startup
sleep 2

# Check if running
if pgrep -f "node server.js" > /dev/null; then
    echo -e "${GREEN}✓ TractionJackson running on port $PORT${NC}"
else
    echo -e "${RED}✗ TractionJackson failed to start${NC}"
    echo "Check logs: tail -50 $LOG_DIR/server.log"
fi

if pgrep -f "node canva-oauth-server.js" > /dev/null; then
    echo -e "${GREEN}✓ OAuth server running on port $CANVA_OAUTH_PORT${NC}"
else
    echo -e "${RED}✗ OAuth server failed to start${NC}"
    echo "Check logs: tail -50 $LOG_DIR/oauth.log"
fi

echo ""
echo "=========================================="
echo "   READY"
echo "=========================================="
echo ""
echo "Main App:    ${PUBLIC_BASE_URL}:${PORT}"
echo "OAuth:       ${PUBLIC_BASE_URL}:${CANVA_OAUTH_PORT}/connect"
echo ""
echo "Logs:        $LOG_DIR/"
echo "Status:      /opt/tj-status.sh"
echo "Restart:     /opt/tj-restart.sh"
echo ""
echo -e "${GREEN}To connect Canva, visit:${NC}"
echo "${PUBLIC_BASE_URL}:${CANVA_OAUTH_PORT}/connect"
echo ""
