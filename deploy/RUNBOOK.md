# TractionJackson Runbook
# VERIFIED: 2025-02-06 from live droplet audit

## Quick Reference (all from Mac terminal)

| Action                | Command |
|-----------------------|---------|
| Deploy code           | `cd ~/GitHub/traction-jackson && git push origin main && ssh -i ~/.ssh/openclaw-admin root@104.248.180.194 "cd /opt/traction-jackson && git fetch origin && git reset --hard origin/main && sudo systemctl restart tj-main tj-oauth"` |
| Restart services      | `ssh -i ~/.ssh/openclaw-admin root@104.248.180.194 "sudo systemctl restart tj-main tj-oauth"` |
| Check integrations    | `ssh -i ~/.ssh/openclaw-admin root@104.248.180.194 "curl -s http://localhost:3000/api/integrations/status \| python3 -m json.tool"` |
| View main server logs | `ssh -i ~/.ssh/openclaw-admin root@104.248.180.194 "sudo journalctl -u tj-main -n 100 --no-pager"` |
| View OAuth logs       | `ssh -i ~/.ssh/openclaw-admin root@104.248.180.194 "sudo journalctl -u tj-oauth -n 100 --no-pager"` |
| SSH into droplet      | `ssh -i ~/.ssh/openclaw-admin root@104.248.180.194` |

---

## Architecture

```
Mac (dev) ──git push──> GitHub (dcrypt-007/traction-jackson)
                              │
Droplet (104.248.180.194)     │
├── /opt/traction-jackson  <──git fetch/reset──
├── /etc/traction-jackson/tj.env  (env vars, secrets)
├── /var/lib/traction-jackson     (runtime data, campaigns)
├── tj-main.service  → node server.js        (port 3000)
└── tj-oauth.service → node canva-oauth-server.js (port 3333)
```

## Pipeline: How Videos Get Audio

1. **Canva autofill** → generates video from template (SILENT — no audio track)
2. **ElevenLabs TTS** → generates narration MP3 from voiceover script
3. **ffmpeg merge** → combines Canva video + ElevenLabs audio into final MP4
4. **ffprobe verify** → confirms merged file has audio stream
5. **campaign-manager** → updates `localVideoPath` to merged file, clears `videoUrl`
6. **UI** → serves local merged file (NOT Canva CDN URL, which is always silent)

## Integrations Status

Check live status: `http://104.248.180.194:3000/api/integrations/status`

| Integration  | Required For           | How to Fix if Broken                                    |
|-------------|------------------------|--------------------------------------------------------|
| Canva       | Video template export  | Visit http://104.248.180.194:3333/connect              |
| ElevenLabs  | TTS narration          | Update key in /etc/traction-jackson/tj.env, restart    |
| ffmpeg      | Audio/video merge      | `apt-get install ffmpeg` on droplet                    |

### ElevenLabs API Key Notes
- Key must start with `sk_` and have **Text to Speech: Access** permission
- Key does NOT need user_read or voices_read permissions
- Manage at: elevenlabs.io → Developers → API Keys
- Health check will show "connected" even with restricted read permissions, as long as TTS access is granted

## Troubleshooting

### "Permission denied (publickey)" on SSH
- Use `~/.ssh/openclaw-admin` — NOT `tj-droplet-deploy` (that key is corrupted)
- Verify: `ssh -i ~/.ssh/openclaw-admin root@104.248.180.194 "echo ok"`

### Services won't start
```bash
ssh -i ~/.ssh/openclaw-admin root@104.248.180.194 "sudo journalctl -u tj-main -n 50 --no-pager"
```

### Git push rejected
```bash
# If droplet has diverged, force reset to match GitHub:
ssh -i ~/.ssh/openclaw-admin root@104.248.180.194 "cd /opt/traction-jackson && git fetch origin && git reset --hard origin/main"
```

### Git index.lock error
```bash
ssh -i ~/.ssh/openclaw-admin root@104.248.180.194 "rm -f /opt/traction-jackson/.git/index.lock /opt/traction-jackson/.git/HEAD.lock"
```

### Update an env var
```bash
ssh -i ~/.ssh/openclaw-admin root@104.248.180.194 "sed -i 's|OLD_VALUE|NEW_VALUE|' /etc/traction-jackson/tj.env && sudo systemctl restart tj-main tj-oauth"
```

### Canva OAuth redirect URI
Must be registered in Canva Developer Portal: `http://104.248.180.194:3333/callback`
