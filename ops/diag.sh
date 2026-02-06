#!/usr/bin/env bash
# ============================================================
# TractionJackson Diagnostics
# One command to see everything. No args needed.
# ============================================================

APP_DIR="/opt/traction-jackson"
ENV_FILE="${APP_DIR}/.env"
DATA_DIR="${APP_DIR}/data"

echo ""
echo "========================================"
echo "  TractionJackson Diagnostics"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "========================================"

# Git state
echo ""
echo "=== DEPLOYED CODE ==="
cd "${APP_DIR}" 2>/dev/null && git log --oneline -3 2>/dev/null || echo "  Repo not found at ${APP_DIR}"

# Service status
echo ""
echo "=== SERVICES ==="
for svc in tj-main tj-oauth caddy; do
    STATUS=$(systemctl is-active ${svc} 2>/dev/null || echo "not-found")
    ENABLED=$(systemctl is-enabled ${svc} 2>/dev/null || echo "not-found")
    printf "  %-12s active=%-10s enabled=%s\n" "${svc}" "${STATUS}" "${ENABLED}"
done

# Ports
echo ""
echo "=== PORTS ==="
ss -tlnp 2>/dev/null | grep -E ':(80|443|3000|3333) ' || echo "  No matching ports found"

# Integrations
echo ""
echo "=== INTEGRATIONS ==="
curl -s http://127.0.0.1:3000/api/integrations/status 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "  API not responding"

# Token state
echo ""
echo "=== TOKEN STORE ==="
if [ -f "${DATA_DIR}/tokens.json" ]; then
    python3 -c "
import json, time
d = json.load(open('${DATA_DIR}/tokens.json'))
c = d.get('canva', {})
if c:
    exp = c.get('expires_at', 0)
    has_access = bool(c.get('access_token'))
    has_refresh = bool(c.get('refresh_token'))
    expired = int(time.time() * 1000) > exp
    print(f'  Access token:  {\"yes\" if has_access else \"no\"}')
    print(f'  Refresh token: {\"yes\" if has_refresh else \"no\"}')
    print(f'  Expired:       {\"yes\" if expired else \"no\"}')
    print(f'  Updated:       {c.get(\"updated_at\", \"unknown\")}')
else:
    print('  No Canva tokens stored')
" 2>/dev/null || echo "  Could not parse tokens.json"
else
    echo "  No tokens.json found"
fi

# Environment (keys redacted)
echo ""
echo "=== ENVIRONMENT ==="
if [ -f "${ENV_FILE}" ]; then
    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ "${line}" =~ ^#.*$ ]] && continue
        [[ -z "${line}" ]] && continue
        KEY=$(echo "${line}" | cut -d= -f1)
        VAL=$(echo "${line}" | cut -d= -f2-)
        # Redact secrets
        if [[ "${KEY}" =~ (SECRET|KEY|TOKEN|PASSWORD) ]]; then
            echo "  ${KEY}=${VAL:0:8}...redacted"
        else
            echo "  ${KEY}=${VAL}"
        fi
    done < "${ENV_FILE}"
else
    echo "  No .env file found at ${ENV_FILE}"
fi

# Disk
echo ""
echo "=== DISK ==="
df -h / | tail -1 | awk '{print "  Total: " $2 "  Used: " $3 "  Free: " $4 "  Use%: " $5}'
echo "  Data dir: $(du -sh ${DATA_DIR} 2>/dev/null | cut -f1 || echo 'N/A')"

# Versions
echo ""
echo "=== VERSIONS ==="
echo "  Node:   $(node -v 2>/dev/null || echo 'not installed')"
echo "  ffmpeg: $(ffmpeg -version 2>&1 | head -1 | awk '{print $3}' || echo 'not installed')"
echo "  Caddy:  $(caddy version 2>/dev/null || echo 'not installed')"
echo "  OS:     $(lsb_release -ds 2>/dev/null || cat /etc/os-release 2>/dev/null | head -1 || echo 'unknown')"

# Recent logs
echo ""
echo "=== RECENT LOGS (tj-main, last 20 lines) ==="
journalctl -u tj-main -n 20 --no-pager 2>/dev/null || echo "  No logs available"

echo ""
echo "=== RECENT LOGS (tj-oauth, last 10 lines) ==="
journalctl -u tj-oauth -n 10 --no-pager 2>/dev/null || echo "  No logs available"

echo ""
echo "=== RECENT LOGS (caddy, last 10 lines) ==="
journalctl -u caddy -n 10 --no-pager 2>/dev/null || echo "  No logs available"

echo ""
echo "========================================"
echo "  Diagnostics complete"
echo "========================================"
echo ""
