# TJ Task: Fix Video Export Pipeline

**Owner:** TJ (API plumbing and external connections)
**Priority:** HIGH
**Status:** Broken - videos not playable

---

## Problem

The "Review Generated Videos" screen shows 6 video cards with copy variations, but:
- Play buttons are not clickable
- Videos cannot be previewed
- Likely cause: videos were never actually exported from Canva

## What's Working

- ✅ Canva OAuth connection
- ✅ Template selection (regular designs, not Brand Templates)
- ✅ Batch generation UI flow
- ✅ Copy variations generated

## What's Broken

The video export step in `campaign-manager.js` → `generateSingleCreative()` is failing silently or not producing actual video files.

## Files to Investigate

1. **canva-export.js** - `exportAndDownload()` function
   - Is it actually calling Canva's export API?
   - Is it downloading the resulting files?
   - Check for error handling

2. **campaign-manager.js** - Step 3: Export video (lines ~137-161)
   - Check if `result.export` is populated
   - Verify `result.videoUrl` and `result.localVideoPath` are set

3. **index.html** - Video card rendering
   - How does it determine video source?
   - Is it looking for the right paths?

## Canva Export API Reference

Endpoint: `POST /designs/{designId}/exports`
- Requires `design:content:read` scope (we have this)
- Returns a job ID, then poll for completion
- Download the resulting URL

## Expected Flow

1. Create design from template with autofill data
2. **Export design as MP4** ← This is broken
3. Download MP4 to local `campaigns/` folder
4. Serve via `/campaigns/` route in server.js
5. UI renders `<video>` with src pointing to local file

## Quick Debug Steps

1. Check server console logs during batch generation
2. Look for `[TJ] Step 3: Exporting video...` messages
3. Check if `campaigns/` folder has any `.mp4` files
4. Test Canva export API directly with curl

## Remember

TJ owns all API plumbing:
- Canva Connect API
- ElevenLabs API
- Video/audio export and merge
- Any external service integration

---

*Written by Claude for TJ coordination*
