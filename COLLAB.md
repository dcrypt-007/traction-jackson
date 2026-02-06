# Claude ↔ TJ Collaboration Protocol

## Overview
This file defines how Cowork Claude and OpenClaw TJ coordinate work on TractionJackson without requiring human intervention for every handoff.

## Communication Channel
**File:** `TASKS.md` in this repo
- Both agents read and write to this file
- Format: Markdown with structured task blocks

## Task Format
```markdown
## [TASK-001] Task Title
- **Status:** PENDING | IN_PROGRESS | BLOCKED | DONE
- **Assigned:** Claude | TJ | HUMAN
- **Priority:** HIGH | MEDIUM | LOW
- **Created:** ISO timestamp
- **Updated:** ISO timestamp

### Description
What needs to be done

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Notes
Any relevant context

### Handoff
When complete, describe what was done and what's next
```

## Capabilities Matrix

| Capability | Claude (Cowork) | TJ (OpenClaw) |
|------------|-----------------|---------------|
| Edit local files | ✓ | ✓ (via git) |
| Run bash/node | ✓ | Limited |
| Browser automation | ✓ | ✗ |
| Code generation | ✓ | ✓ (specialized) |
| API calls | ✓ | ✓ |
| Product vision | Limited | ✓ |
| Git commits | ✓ | ✓ |

## Workflow

### 1. Task Creation
Either agent can create tasks in TASKS.md

### 2. Task Assignment
- Browser/OAuth/local testing → Claude
- Code architecture/generation → TJ
- API integration logic → Either
- UI/UX improvements → TJ generates, Claude implements

### 3. Handoff Protocol
1. Completing agent marks task DONE
2. Adds "Handoff" section describing work done
3. Creates follow-up task if needed
4. Other agent picks up next task

### 4. Blocking Issues
If blocked, agent sets status to BLOCKED and describes the blocker.
Human intervention requested only for:
- Credentials/secrets
- Purchasing decisions
- External service approvals
- Unclear requirements

## Current Sprint: Video Preview Fix

### Immediate Tasks
1. **Wire up Canva video export** - Get real video URLs into UI
2. **Connect 11Labs voiceovers** - Generate audio for hooks
3. **Merge video + audio** - Create final creative assets
4. **Display in preview** - Replace placeholders with real content

## Git-Based Sync
- TJ pushes to repo
- Claude pulls and tests locally
- Claude pushes fixes
- TJ reviews and continues

## Quick Commands

For Claude:
```bash
cd /Users/danielripoll/GitHub/traction-jackson
git pull
./start.sh  # Run server with tokens
```

For TJ:
```
Review TASKS.md, implement assigned items, push to main
```
