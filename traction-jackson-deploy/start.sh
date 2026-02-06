#!/bin/bash
# TractionJackson Startup Script
#
# OAuth tokens are now persisted in data/tokens.json
# Client credentials are needed for token refresh

# ===================
# REQUIRED FOR SECURITY
# ===================
# Admin secret for sensitive endpoints (connect/disconnect)
# Generate with: openssl rand -hex 32
export ADMIN_SECRET="${ADMIN_SECRET:-}"

# Public URL for remote OAuth (e.g., http://your-droplet-ip or https://tj.yourdomain.com)
# If not set, falls back to request host header
export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"

# ===================
# CANVA OAUTH
# ===================
export CANVA_CLIENT_ID="${CANVA_CLIENT_ID:-OC-AZwonqEGPo_y}"
export CANVA_CLIENT_SECRET="${CANVA_CLIENT_SECRET:-}"
export CANVA_OAUTH_PORT="${CANVA_OAUTH_PORT:-3333}"

# ===================
# OPTIONAL
# ===================
# ElevenLabs API key
export ELEVENLABS_API_KEY="${ELEVENLABS_API_KEY:-}"

# Allow deprecated manual token import (not recommended for production)
# export ALLOW_MANUAL_TOKEN_IMPORT=true

# ===================
# STARTUP
# ===================
echo ""
echo "Starting TractionJackson..."
echo "- Admin Secret: ${ADMIN_SECRET:+configured}"
echo "- Public URL: ${PUBLIC_BASE_URL:-not set (using host header)}"
echo "- Canva Client ID: ${CANVA_CLIENT_ID:0:10}..."
echo "- ElevenLabs: ${ELEVENLABS_API_KEY:+configured}"
echo ""

if [ -z "$ADMIN_SECRET" ]; then
  echo "WARNING: ADMIN_SECRET not set. Sensitive endpoints will return 500."
  echo "Generate one with: openssl rand -hex 32"
  echo ""
fi

node server.js
