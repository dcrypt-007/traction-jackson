#!/usr/bin/env bash
# ============================================================
# TractionJackson Deploy Script
# Pulls latest code and restarts services. Safe to run anytime.
# ============================================================
set -euo pipefail

APP_DIR="/opt/traction-jackson"

echo "[deploy] Fetching latest code..."
cd "${APP_DIR}"
git fetch origin
BEFORE=$(git rev-parse --short HEAD)
git reset --hard origin/main
AFTER=$(git rev-parse --short HEAD)

if [ "${BEFORE}" = "${AFTER}" ]; then
    echo "[deploy] Already at latest: ${AFTER}"
else
    echo "[deploy] Updated: ${BEFORE} -> ${AFTER}"
fi

echo "[deploy] Restarting services..."
systemctl restart tj-main tj-oauth

sleep 3

echo "[deploy] Status:"
systemctl is-active tj-main    | xargs -I{} echo "  tj-main:  {}"
systemctl is-active tj-oauth   | xargs -I{} echo "  tj-oauth: {}"

echo "[deploy] Commit: $(git log --oneline -1)"
echo "[deploy] Done."
