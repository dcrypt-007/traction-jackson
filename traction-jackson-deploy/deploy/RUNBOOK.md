# TractionJackson Runbook for Dan

## Quick Reference

| Action | Command |
|--------|---------|
| Start/Restart | `/opt/tj-restart.sh` |
| Check Status | `/opt/tj-status.sh` |
| View Logs | `tail -50 /var/log/traction-jackson/server.log` |
| Connect Canva | Visit `http://<DROPLET_IP>:3333/connect` |

---

## First-Time Setup (One Time Only)

### 1. SSH into your droplet
```
ssh root@<DROPLET_IP>
```

### 2. Run the installer
```
cd /home/openclaw/traction-jackson/deploy
sudo bash install.sh
```

### 3. Configure secrets
Edit `/opt/tj.env`:
```
nano /opt/tj.env
```

Fill in these values:
```
ADMIN_SECRET=<generate with: openssl rand -hex 32>
PUBLIC_BASE_URL=http://<DROPLET_IP>
CANVA_CLIENT_SECRET=<from Canva Developer Portal>
```

Save and exit (Ctrl+X, Y, Enter).

### 4. Start the server
```
/opt/tj-dev.sh
```

### 5. Connect Canva
Open in your browser:
```
http://<DROPLET_IP>:3333/connect
```

Follow the Canva authorization flow. Tokens are saved automatically.

### 6. Restart to load tokens
```
/opt/tj-restart.sh
```

### 7. Open TractionJackson
```
http://<DROPLET_IP>:3000
```

---

## Daily Operations

### Starting TractionJackson
```
/opt/tj-restart.sh
```

### Checking if it's running
```
/opt/tj-status.sh
```

### Viewing recent logs
```
tail -50 /var/log/traction-jackson/server.log
```

### If Canva shows "Not Connected"
1. Visit: `http://<DROPLET_IP>:3333/connect`
2. Complete authorization
3. Run: `/opt/tj-restart.sh`

---

## Troubleshooting

### Server won't start
Check logs:
```
tail -100 /var/log/traction-jackson/server.log
```

### "ADMIN_SECRET not configured"
Edit `/opt/tj.env` and add your admin secret:
```
ADMIN_SECRET=$(openssl rand -hex 32)
```

### "PUBLIC_BASE_URL not set"
Edit `/opt/tj.env` and set your droplet IP:
```
PUBLIC_BASE_URL=http://159.65.123.45
```

### OAuth callback error
Make sure `PUBLIC_BASE_URL` in `/opt/tj.env` matches what's registered in Canva Developer Portal as the redirect URI:
```
http://<DROPLET_IP>:3333/callback
```

### Port already in use
Kill existing processes:
```
pkill -f "node server.js"
pkill -f "node canva-oauth-server.js"
```
Then restart:
```
/opt/tj-restart.sh
```

---

## URLs

| Service | URL |
|---------|-----|
| TractionJackson App | `http://<DROPLET_IP>:3000` |
| Canva OAuth Connect | `http://<DROPLET_IP>:3333/connect` |
| API Status | `http://<DROPLET_IP>:3000/api/status` |

---

## Important: Canva Redirect URI

You must add this redirect URI in your Canva app settings:
```
http://<DROPLET_IP>:3333/callback
```

Go to: https://www.canva.com/developers/apps/<your-app-id>/configuration
Add the redirect URI under "Redirect URLs".
