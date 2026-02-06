#!/usr/bin/env bash
# ============================================================
# TractionJackson Bootstrap Script
# IDEMPOTENT: Safe to run multiple times. "Already exists" = no-op.
# ============================================================
set -euo pipefail

APP_DIR="/opt/traction-jackson"
DATA_DIR="${APP_DIR}/data"
ENV_FILE="${APP_DIR}/.env"
REPO_URL="https://github.com/dcrypt-007/traction-jackson.git"
DOMAIN="tractionjackson.com"

echo ""
echo "========================================"
echo "  TractionJackson Bootstrap"
echo "========================================"
echo ""

# ------------------------------------------------------------
# 1. System packages
# ------------------------------------------------------------
echo "[1/8] Installing system packages..."
apt-get update -qq
apt-get install -y -qq git curl ffmpeg debian-keyring debian-archive-keyring apt-transport-https 2>&1 | tail -3
echo "  -> Packages installed"

# ------------------------------------------------------------
# 2. Install Caddy (idempotent - skips if already installed)
# ------------------------------------------------------------
echo "[2/8] Installing Caddy..."
if command -v caddy &>/dev/null; then
    echo "  -> Caddy already installed: $(caddy version)"
else
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
    apt-get update -qq
    apt-get install -y -qq caddy 2>&1 | tail -3
    echo "  -> Caddy installed: $(caddy version)"
fi

# ------------------------------------------------------------
# 3. Stop and disable nginx if present (Caddy replaces it)
# ------------------------------------------------------------
echo "[3/8] Removing nginx (Caddy replaces it)..."
if systemctl is-active --quiet nginx 2>/dev/null; then
    systemctl stop nginx
    systemctl disable nginx
    echo "  -> nginx stopped and disabled"
else
    echo "  -> nginx not running (ok)"
fi

# ------------------------------------------------------------
# 4. Clone or update repo
# ------------------------------------------------------------
echo "[4/8] Setting up app directory..."
if [ -d "${APP_DIR}/.git" ]; then
    cd "${APP_DIR}"
    git fetch origin
    git reset --hard origin/main
    echo "  -> Repo updated to latest main"
else
    git clone "${REPO_URL}" "${APP_DIR}"
    cd "${APP_DIR}"
    echo "  -> Repo cloned"
fi

# ------------------------------------------------------------
# 5. Create data directory (persists across deploys)
# ------------------------------------------------------------
echo "[5/8] Creating data directory..."
mkdir -p "${DATA_DIR}"
chmod 700 "${DATA_DIR}"
echo "  -> ${DATA_DIR} ready"

# Migrate tokens from old location if they exist
if [ -f "${APP_DIR}/data/tokens.json" ] && [ "${APP_DIR}/data" != "${DATA_DIR}" ]; then
    echo "  -> Tokens already in correct location"
elif [ -f "/var/lib/traction-jackson/tokens.json" ]; then
    cp /var/lib/traction-jackson/tokens.json "${DATA_DIR}/tokens.json"
    echo "  -> Migrated tokens from old location"
fi

# ------------------------------------------------------------
# 6. Create .env if it doesn't exist
# ------------------------------------------------------------
echo "[6/8] Checking environment file..."
if [ -f "${ENV_FILE}" ]; then
    echo "  -> ${ENV_FILE} already exists (not overwriting)"
else
    # Migrate from old location if it exists
    if [ -f "/etc/traction-jackson/tj.env" ]; then
        cp /etc/traction-jackson/tj.env "${ENV_FILE}"
        # Ensure new required vars are present
        grep -q "CANVA_REDIRECT_URI" "${ENV_FILE}" || echo "CANVA_REDIRECT_URI=https://${DOMAIN}/oauth/callback" >> "${ENV_FILE}"
        grep -q "TJ_DATA_DIR" "${ENV_FILE}" || echo "TJ_DATA_DIR=${DATA_DIR}" >> "${ENV_FILE}"
        echo "  -> Migrated from /etc/traction-jackson/tj.env"
    else
        cp "${APP_DIR}/ops/env.template" "${ENV_FILE}"
        # Generate admin secret automatically
        GENERATED_SECRET=$(openssl rand -hex 32)
        sed -i "s|__GENERATE_WITH_openssl_rand_-hex_32__|${GENERATED_SECRET}|" "${ENV_FILE}"
        echo "  -> Created ${ENV_FILE} from template"
        echo "  !! IMPORTANT: Edit ${ENV_FILE} and fill in your secrets !!"
    fi
fi
chmod 600 "${ENV_FILE}"

# Remove duplicate lines in .env (cleanup from previous patches)
awk '!seen[$0]++' "${ENV_FILE}" > "${ENV_FILE}.tmp" && mv "${ENV_FILE}.tmp" "${ENV_FILE}"

# ------------------------------------------------------------
# 7. Install systemd services
# ------------------------------------------------------------
echo "[7/8] Installing systemd services..."
cp "${APP_DIR}/ops/systemd/tj-main.service" /etc/systemd/system/tj-main.service
cp "${APP_DIR}/ops/systemd/tj-oauth.service" /etc/systemd/system/tj-oauth.service
systemctl daemon-reload
systemctl enable tj-main tj-oauth
echo "  -> Services installed and enabled"

# ------------------------------------------------------------
# 8. Install Caddyfile and start everything
# ------------------------------------------------------------
echo "[8/8] Configuring Caddy and starting services..."
cp "${APP_DIR}/ops/Caddyfile" /etc/caddy/Caddyfile
systemctl restart caddy
systemctl restart tj-main
systemctl restart tj-oauth

# Wait for services to start
sleep 4

echo ""
echo "========================================"
echo "  Bootstrap Complete"
echo "========================================"
echo ""
echo "Services:"
systemctl is-active tj-main    | xargs -I{} echo "  tj-main:  {}"
systemctl is-active tj-oauth   | xargs -I{} echo "  tj-oauth: {}"
systemctl is-active caddy      | xargs -I{} echo "  caddy:    {}"
echo ""
echo "URLs:"
echo "  App:    https://${DOMAIN}"
echo "  OAuth:  https://${DOMAIN}/oauth/connect"
echo "  Status: https://${DOMAIN}/api/integrations/status"
echo ""

# Quick health check
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/integrations/status 2>/dev/null || echo "000")
if [ "${HTTP_CODE}" = "200" ]; then
    echo "Health check: PASS (API responding)"
    curl -s http://127.0.0.1:3000/api/integrations/status | python3 -m json.tool 2>/dev/null || true
else
    echo "Health check: WAITING (API returned ${HTTP_CODE}, may still be starting)"
fi

echo ""
echo "Next steps:"
echo "  1. Edit /opt/traction-jackson/.env if secrets need updating"
echo "  2. Visit https://${DOMAIN}/oauth/connect to connect Canva"
echo "  3. Run: bash /opt/traction-jackson/ops/diag.sh to verify"
echo ""
