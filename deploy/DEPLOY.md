# TractionJackson Deploy Config
# VERIFIED: 2025-02-06 from live droplet audit

## GitHub
- **Repo:** https://github.com/dcrypt-007/traction-jackson.git
- **Username:** dcrypt-007 (NOT danrip)

## Droplet Access
- **IP:** 104.248.180.194
- **User:** root
- **SSH Key:** ~/.ssh/openclaw-admin
- **SSH Shortcut:** `ssh tj-droplet`
- **SSH Full:** `ssh -i ~/.ssh/openclaw-admin root@104.248.180.194`

## Droplet Paths
- **App code:** /opt/traction-jackson
- **Env file:** /etc/traction-jackson/tj.env (NOT /opt/tj.env)
- **Data dir:** /var/lib/traction-jackson
- **Systemd units:** /etc/systemd/system/tj-main.service, tj-oauth.service

## Services
| Service   | Port | Systemd Unit  | Entry Point            |
|-----------|------|---------------|------------------------|
| Main App  | 3000 | tj-main       | server.js              |
| OAuth     | 3333 | tj-oauth      | canva-oauth-server.js  |

## Live URLs
- **App:** http://104.248.180.194:3000
- **OAuth Connect:** http://104.248.180.194:3333/connect
- **Integrations Check:** http://104.248.180.194:3000/api/integrations/status

## Verified Tool Versions (2025-02-06)
- **Node:** v22.22.0
- **ffmpeg:** 6.1.1
- **OS:** Ubuntu (DigitalOcean droplet, 4GB RAM, 116GB disk)

## SSH Config (in ~/.ssh/config on Mac)
```
Host tj-droplet
  HostName 104.248.180.194
  User root
  IdentityFile ~/.ssh/openclaw-admin
```

## Deploy Command (from Mac terminal)
```bash
cd ~/GitHub/traction-jackson && git push origin main && ssh -i ~/.ssh/openclaw-admin root@104.248.180.194 "cd /opt/traction-jackson && git fetch origin && git reset --hard origin/main && sudo systemctl restart tj-main tj-oauth"
```

## Restart Only
```bash
ssh -i ~/.ssh/openclaw-admin root@104.248.180.194 "sudo systemctl restart tj-main tj-oauth"
```

## Check Logs
```bash
ssh -i ~/.ssh/openclaw-admin root@104.248.180.194 "sudo journalctl -u tj-main -n 100 --no-pager"
```

## Check Integrations Status
```bash
ssh -i ~/.ssh/openclaw-admin root@104.248.180.194 "curl -s http://localhost:3000/api/integrations/status | python3 -m json.tool"
```

## Important Rules
- Env vars live in /etc/traction-jackson/tj.env — NOT /opt/tj.env or /opt/openclaw.env
- Always deploy via git push + git fetch/reset on droplet (never scp individual files)
- Only restart tj-main and tj-oauth. Do NOT touch OpenClaw services.
- The repo on the droplet is a git clone — never edit files directly on the droplet.
- SSH key is ~/.ssh/openclaw-admin — NOT tj-droplet-deploy (that key is corrupted).
