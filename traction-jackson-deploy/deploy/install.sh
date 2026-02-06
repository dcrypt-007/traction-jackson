#!/bin/bash
# TractionJackson Droplet Installer
# Run this once to set up the droplet
#
# Usage: sudo bash install.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "   TractionJackson Droplet Setup"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo bash install.sh)${NC}"
    exit 1
fi

# Variables
TJ_DIR="/home/openclaw/traction-jackson"
DEPLOY_DIR="$TJ_DIR/deploy"

# Check repo exists
if [ ! -d "$TJ_DIR" ]; then
    echo -e "${RED}TractionJackson repo not found at $TJ_DIR${NC}"
    echo ""
    echo "Clone it first:"
    echo "  cd /home/openclaw"
    echo "  git clone <your-repo-url> traction-jackson"
    exit 1
fi

echo "Installing management scripts..."

# Copy scripts to /opt
cp "$DEPLOY_DIR/tj-dev.sh" /opt/tj-dev.sh
cp "$DEPLOY_DIR/tj-status.sh" /opt/tj-status.sh
cp "$DEPLOY_DIR/tj-restart.sh" /opt/tj-restart.sh

# Make executable
chmod +x /opt/tj-dev.sh
chmod +x /opt/tj-status.sh
chmod +x /opt/tj-restart.sh

echo -e "${GREEN}✓ Scripts installed to /opt/${NC}"

# Create env file if not exists
if [ ! -f "/opt/tj.env" ]; then
    cp "$DEPLOY_DIR/tj.env.template" /opt/tj.env
    chmod 600 /opt/tj.env
    echo -e "${YELLOW}⚠ Created /opt/tj.env - YOU MUST EDIT IT${NC}"
else
    echo -e "${GREEN}✓ /opt/tj.env already exists${NC}"
fi

# Create log directory
mkdir -p /var/log/traction-jackson
mkdir -p /var/run/traction-jackson
chown -R openclaw:openclaw /var/log/traction-jackson
chown -R openclaw:openclaw /var/run/traction-jackson

echo -e "${GREEN}✓ Log directories created${NC}"

# Create data directory for token store
mkdir -p "$TJ_DIR/data"
chown -R openclaw:openclaw "$TJ_DIR/data"
chmod 700 "$TJ_DIR/data"

echo -e "${GREEN}✓ Token store directory created${NC}"

# Install dependencies if needed
if [ ! -d "$TJ_DIR/node_modules" ]; then
    echo "Installing npm dependencies..."
    cd "$TJ_DIR"
    sudo -u openclaw npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
fi

echo ""
echo "=========================================="
echo "   Setup Complete!"
echo "=========================================="
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Edit /opt/tj.env and fill in:"
echo "   - ADMIN_SECRET (generate with: openssl rand -hex 32)"
echo "   - PUBLIC_BASE_URL (your droplet IP, e.g., http://159.65.123.45)"
echo "   - CANVA_CLIENT_SECRET"
echo ""
echo "2. Start the server:"
echo "   /opt/tj-dev.sh"
echo ""
echo "3. Connect Canva by visiting:"
echo "   http://<your-droplet-ip>:3333/connect"
echo ""
