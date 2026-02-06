# TractionJackson Task Board

Last Updated: 2026-02-05T01:00:00Z

---

## [TASK-002] Test Full Pipeline with Real Template
- **Status:** IN_PROGRESS
- **Assigned:** TJ / User
- **Priority:** HIGH
- **Created:** 2026-02-05T00:00:00Z
- **Updated:** 2026-02-05T01:00:00Z

### Description
Claude has wired up the full UI integration. The index.html now connects to the Node.js backend.

**To test:**
1. Start the backend: `./start.sh`
2. Open in browser: `file:///Users/danielripoll/GitHub/traction-jackson/index.html`
3. Click an experiment or create a new one
4. In Step 1 (Batch), you should see:
   - API status indicators (Canva Connected / ElevenLabs Connected)
   - Template dropdown auto-populated from your Canva Brand Templates
5. Click "Generate Batch" - this calls the real Canva API
6. In Step 2 (Approve), videos should show actual content with:
   - Video player with controls
   - Voiceover audio player
   - Download links

### Acceptance Criteria
- [ ] Backend server starts without errors
- [ ] Template dropdown populates with Canva Brand Templates
- [ ] Generate Batch creates real videos via Canva API
- [ ] Video previews display in the Approve step
- [ ] Voiceover audio plays correctly

### Notes
- **Important:** You need a Canva for Teams account with Brand Templates enabled
- The access token in start.sh expires after ~4 hours
- If no templates appear, check that Brand Templates exist in your Canva account

### Handoff
_Ready for testing_

---

## [TASK-003] Audio/Video Merge Pipeline
- **Status:** DONE
- **Assigned:** Claude
- **Priority:** MEDIUM
- **Created:** 2026-02-05T00:00:00Z
- **Updated:** 2026-02-05T08:15:00Z
- **Completed:** 2026-02-05T08:15:00Z

### Description
Currently video and voiceover are generated separately. Need to merge them into a single final video file.

### Acceptance Criteria
- [x] ffmpeg integration for audio/video merge
- [x] Voiceover timing matches video duration
- [x] Final output is single MP4 with embedded audio

### What Was Done

**New File: `ffmpeg-merge.js`**
- `mergeVideoAudio()` - Merges video + audio into single MP4
- `batchMerge()` - Batch process multiple pairs
- `checkFfmpeg()` - Verify ffmpeg availability
- `getVideoDuration()` / `getAudioDuration()` - Duration utilities
- Features: audio normalization, fade in/out, volume control
- CLI support: `node ffmpeg-merge.js video.mp4 audio.mp3 [output.mp4]`

**Updated: `campaign-manager.js`**
- Added Step 5 to `generateSingleCreative()` pipeline
- Auto-merges video + voiceover after both are generated
- Gracefully skips if ffmpeg not installed
- Stores merged video path in `result.finalVideoPath`

**Updated: `package.json`**
- Added `ffmpeg-static` as optional dependency
- Added npm scripts: `npm run merge`, `npm run install-ffmpeg`

### Installation
```bash
# Install ffmpeg support (optional but recommended)
npm run install-ffmpeg
# Or: npm install ffmpeg-static
```

### Handoff
Ready to test! The pipeline now automatically merges video + voiceover.
Run `./start.sh` and generate a batch to see merged output in `campaigns/<name>/videos/`

---

## Completed Tasks

### [TASK-001] Wire Up Video Previews + UI Integration ✅
- **Status:** DONE
- **Assigned:** Claude
- **Priority:** HIGH
- **Created:** 2026-02-05T00:00:00Z
- **Completed:** 2026-02-05T01:00:00Z

### What Was Done

**Backend Updates (server.js, canva-export.js, campaign-manager.js):**
- Modified `exportAndDownload()` to return remote Canva URLs
- Updated `generateSingleCreative()` to preserve video/thumbnail URLs
- Added static file serving with HTTP range requests for video streaming
- Added `/campaigns/*` route for serving local campaign files

**Frontend Integration (index.html):**
1. Added API configuration connecting to `http://localhost:3000`
2. **BatchStep component:**
   - Added API status indicators (Canva/ElevenLabs connection status)
   - Auto-fetches available Brand Templates from Canva on mount
   - Template dropdown for selection (no manual ID entry)
   - Real API call to `/api/campaign` when "Generate Batch" is clicked
   - Progress messages during generation
3. **ApproveStep component:**
   - Video cards now display actual `<video>` elements with controls
   - Poster image from Canva thumbnail
   - Audio player for voiceover preview
   - Download links for video and audio files
   - Design ID shown as a tag
4. **ExperimentFlowView:**
   - `handleGenerate()` now accepts real video data from API
   - Falls back to mock data if API unavailable

### Files Modified
- `/index.html` - Major UI integration (~200 lines changed)
- `/canva-export.js` - Added URLs to return value
- `/campaign-manager.js` - Preserve URLs in response
- `/server.js` - Static file serving

### Testing Instructions
```bash
# Terminal 1: Start backend
cd /Users/danielripoll/GitHub/traction-jackson
./start.sh

# Browser: Open the UI
open file:///Users/danielripoll/GitHub/traction-jackson/index.html
```

### Known Limitations
- Video and voiceover are separate files (TASK-003 will merge them)
- Requires Canva for Teams with Brand Templates
- Access token expires after ~4 hours
