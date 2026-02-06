# TractionJackson Deploy Config

## Droplet Access
- **IP:** 104.248.180.194
- **User:** root
- **SSH Key:** ~/.ssh/tj-droplet-deploy
- **SSH Command:** `ssh -i ~/.ssh/tj-droplet-deploy root@104.248.180.194`

## Droplet Paths
- **App:** /opt/traction-jackson
- **Env file:** /etc/traction-jackson/tj.env
- **Services:** tj-main (port 3000), tj-oauth (port 3333)
- **Live URL:** http://104.248.180.194:3000

## Deploy (from Mac terminal)
```bash
cd ~/GitHub/traction-jackson && git push origin main && ssh -i ~/.ssh/tj-droplet-deploy root@104.248.180.194 "cd /opt/traction-jackson && git pull origin main && sudo systemctl restart tj-main tj-oauth"
```

## Restart Only
```bash
ssh -i ~/.ssh/tj-droplet-deploy root@104.248.180.194 "sudo systemctl restart tj-main tj-oauth"
```

## Check Logs
```bash
ssh -i ~/.ssh/tj-droplet-deploy root@104.248.180.194 "sudo journalctl -u tj-main -n 100 --no-pager"
```

## Verify Integrations
```bash
ssh -i ~/.ssh/tj-droplet-deploy root@104.248.180.194 "curl -s http://localhost:3000/api/integrations/status | python3 -m json.tool"
```

## SSH Config (add to ~/.ssh/config for shortcut)
```
Host tj-droplet
  HostName 104.248.180.194
  User root
  IdentityFile ~/.ssh/tj-droplet-deploy
```

## Important
- Env vars are in /etc/traction-jackson/tj.env, NOT /opt/openclaw.env
- Only restart tj-main and tj-oauth. Do NOT touch OpenClaw services.
- The repo on the droplet is a git clone — always deploy via git push + git pull.
