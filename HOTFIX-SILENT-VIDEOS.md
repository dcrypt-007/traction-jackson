# TractionJackson Hotfix: Silent Videos + Truthful Integrations

## Root Cause (one sentence)

The UI served the Canva CDN URL (always silent) instead of the locally-merged ffmpeg output, AND `campaign-manager.js` never updated `localVideoPath` to point to the merged file — so even the fallback path served the wrong MP4.

---

## Debug-First Steps (run these ON the droplet)

### 1. Confirm tj-main sees ELEVENLABS_API_KEY

```bash
sudo systemctl show tj-main --property=Environment | tr ' ' '\n' | grep -i eleven
```

**Expected:** `ELEVENLABS_API_KEY=sk-...` (non-empty)

If empty, inspect the env file and restart:
```bash
grep ELEVENLABS /etc/traction-jackson/tj.env
sudo systemctl restart tj-main
```

### 2. Confirm ElevenLabs key works

```bash
bash -lc 'source /etc/traction-jackson/tj.env && curl -sS https://api.elevenlabs.io/v1/user -H "xi-api-key: $ELEVENLABS_API_KEY" | head -c 200'
```

**Expected:** JSON user object with `first_name`, `subscription`, etc. (NOT `invalid_api_key`).

### 3. Confirm ffmpeg exists

```bash
which ffmpeg && ffmpeg -version | head -2
```

**Expected:** Path like `/usr/bin/ffmpeg` and version string.

### 4. Find latest campaign and check for audio artifacts

```bash
ls -lt /opt/traction-jackson/campaigns | head -5
```

Pick the newest folder, then:
```bash
find /opt/traction-jackson/campaigns/<NEWEST> -maxdepth 2 -type f | head -40
```

**Look for:** `voiceovers/` directory with `.mp3` files, `videos/` with `_final.mp4` files.

### 5. Check whether current MP4s have audio

```bash
ffprobe -hide_banner -i /opt/traction-jackson/campaigns/<NEWEST>/videos/*.mp4 2>&1 | grep -iE "Stream #|Audio|Video" | head -40
```

**If no audio stream found**, you'll only see `Video: h264` lines. After the fix, `_final.mp4` files should show BOTH `Video:` and `Audio: aac`.

### 6. Manual merge test (confirm ffmpeg can do it)

```bash
# Grab any existing video + generate a test audio
bash -lc 'source /etc/traction-jackson/tj.env && curl -sS "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL" -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" -d "{\"text\":\"Test audio for TractionJackson merge\",\"model_id\":\"eleven_multilingual_v2\"}" --output /tmp/test_voice.mp3'

# Pick any existing silent mp4
VIDEO=$(find /opt/traction-jackson/campaigns -name "*.mp4" -not -name "*_final*" | head -1)

# Merge
ffmpeg -y -i "$VIDEO" -i /tmp/test_voice.mp3 -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest /tmp/test_with_audio.mp4

# Verify audio stream exists
ffprobe -hide_banner -i /tmp/test_with_audio.mp4 2>&1 | grep -iE "Audio|Video"
```

**Expected:** Both `Video: h264` and `Audio: aac` lines.

### 7. One-command end-to-end test (no UI)

```bash
cd /opt/traction-jackson && bash -lc 'source /etc/traction-jackson/tj.env && node elevenlabs-voice.js "$ELEVENLABS_API_KEY" test'
```

**Expected:** Generates a `.mp3` file in the current directory.

---

## Files Changed + Diff Summary

### campaign-manager.js (PRIMARY FIX)

| Change | Why |
|--------|-----|
| After merge: `result.localVideoPath = mergeResult.outputPath` | **THE FIX** — UI now serves merged MP4 instead of silent Canva export |
| After merge: `result.videoUrl = null` | Prevents UI from preferring CDN URL over local merged file |
| Added `verifyAudioStream()` call (Step 6) | Logs `[AudioCheck] audio_stream=true/false` + saves to manifest |
| Added `errors/` + `audio/` subdirectories | Error files written on failure |
| `writeErrorFile()` method | Persists errors to `campaigns/<id>/errors/variant_N.txt` |
| Warning when `voiceoverScript` present but no API key | `[ElevenLabs] WARNING: ...ELEVENLABS_API_KEY not set` |
| `[ElevenLabs]`, `[FFMPEG]`, `[AudioCheck]` log prefixes | Visible in `journalctl -u tj-main` |

### ffmpeg-merge.js

| Change | Why |
|--------|-----|
| Added `verifyAudioStream(filePath)` | Runs ffprobe (or ffmpeg -i fallback) to confirm audio stream exists |
| Added `checkFfmpegVersion()` | Returns `{ available, version }` for health check endpoint |
| Added `getFfprobePath()` | Resolves ffprobe binary (ffprobe-static → system → derived) |
| Changed log prefixes to `[FFMPEG]` | Consistent journalctl filtering |

### server.js

| Change | Why |
|--------|-----|
| Added `GET /api/integrations/status` endpoint | **Deliverable A** — Real health checks for Canva, ElevenLabs, ffmpeg |
| Canva check: calls `tokenStore.getValidCanvaToken()` | Verifies token exists and refresh works |
| ElevenLabs check: HTTPS GET to `/v1/user` | Validates API key actually works (not just env var present) |
| ffmpeg check: calls `checkFfmpegVersion()` | Returns version string or failure reason |

### index.html

| Change | Why |
|--------|-----|
| `API_BASE = ''` (was `http://localhost:3000`) | Relative URLs work on any host (droplet IP, domain, localhost) |
| Video source: `localPath \|\| videoUrl` (was `videoUrl \|\| localPath`) | **THE FIX** — Prefers local merged file over silent CDN |
| Data mapping: `creative.finalVideoPath \|\| creative.localVideoPath` | Picks up merged file path from backend |
| Added `hasAudioStream` to video data mapping | Enables audio badge in player |
| Added red "No audio track generated" badge overlay | Shows when `hasAudioStream === false` |
| Replaced hardcoded Setup page with `<SetupPage />` component | **Deliverable B** — Real integration status |
| `SetupPage` calls `GET /api/integrations/status` | Live Canva/ElevenLabs/ffmpeg checks |
| Per-integration "Test" button | Re-runs individual health check |
| Meta + TikTok shown as "Coming soon" (greyed out) | Honest — not yet implemented |

---

## Deployment Commands

```bash
# 1. Copy files to droplet (from your local machine)
scp campaign-manager.js ffmpeg-merge.js server.js index.html root@104.248.180.194:/opt/traction-jackson/

# 2. SSH in and restart
ssh root@104.248.180.194
sudo systemctl restart tj-main tj-oauth

# 3. Verify services running
sudo systemctl status tj-main tj-oauth

# 4. Check logs for the new prefixes
sudo journalctl -u tj-main -n 120 --no-pager | grep -E '\[ElevenLabs\]|\[FFMPEG\]|\[AudioCheck\]|\[TokenStore\]'

# 5. Quick API test for the new integrations endpoint
curl -s http://localhost:3000/api/integrations/status | python3 -m json.tool
```

---

## UI Test Plan

### Test 1: Integrations page is truthful

1. Open `http://104.248.180.194:3000`
2. Click **Setup** in sidebar
3. **Verify:** Canva shows Connected (green) with reason "Valid access token"
4. **Verify:** ElevenLabs shows Connected (green) with reason "Authenticated as [name]"
5. **Verify:** FFmpeg shows Connected (green) with version string
6. **Verify:** Meta and TikTok show "Not Yet Available" (greyed out)
7. Click **Test** button on ElevenLabs — should re-check and confirm

### Test 2: Generated videos have audio

1. Go to **Dashboard** → open an experiment → **Generate Batch**
2. Select a template, set 1-2 variants, click **Generate Batch**
3. Wait for generation to complete
4. **Verify:** Video player has working volume control (not greyed out)
5. **Verify:** Play the video — you should hear ElevenLabs narration
6. **Verify:** No red "No audio track generated" badge appears

### Test 3: Audio verification in logs

```bash
sudo journalctl -u tj-main -f
```

While generating, look for:
- `[ElevenLabs] Generating voiceover...`
- `[ElevenLabs] Saved audio: /opt/traction-jackson/campaigns/.../voiceovers/vo_xxx.mp3`
- `[FFMPEG] Merging video + audio...`
- `[FFMPEG] Updated localVideoPath to merged file, cleared CDN URL`
- `[AudioCheck] file=xxx_final.mp4 audio_stream=true`

### Test 4: Error handling (simulate)

1. Temporarily remove `ELEVENLABS_API_KEY` from `/etc/traction-jackson/tj.env`
2. Restart: `sudo systemctl restart tj-main`
3. Generate a batch
4. **Verify:** Setup page shows ElevenLabs as Disconnected
5. **Verify:** Video plays but shows red "No audio track generated" badge
6. **Verify:** Error file exists at `campaigns/<id>/errors/variant_1.txt`
7. Restore the key and restart

### Test 5: ffprobe verification

```bash
# After a new campaign generates, find the final mp4:
FINAL=$(find /opt/traction-jackson/campaigns -name "*_final.mp4" -newer /tmp/test_with_audio.mp4 | head -1)
ffprobe -hide_banner -i "$FINAL" 2>&1 | grep -iE "Stream|Audio|Video"
```

**Expected:** Both `Video: h264` and `Audio: aac` streams present.
