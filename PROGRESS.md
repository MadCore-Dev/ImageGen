# ImageGen Fix Progress Log

> Heartbeat file — updated after each chunk of work.
> Source of truth for what changed, when, and why.

---

## Chunk 1 — P0 Quick Wins ⚡
**Date:** 2026-03-01 18:01 IST | **Status:** ✅ COMPLETE

### Changes Made

#### 1. `animDefinitions` Undefined Crash Fixed (`retryActiveCell`)
- **Was:** `animDefinitions[animId]` → ReferenceError on every Retry Frame click
- **Now:** Lookup via `ANIMATION_PRESETS.find(p => p.id === animId)` + proper per-frame keyframe prompt

#### 2. Wrong Prompt Arg Order Fixed (`retryActiveCell`)
- **Was:** `buildImg2ImgWorkflow(upload, animPrompt, positiveInput, negativeInput)` — mismatched args
- **Now:** Correct signature with sprite-specific positive/negative keywords

#### 3. Duplicate `approveReference()` Removed
- **Was:** Two conflicting implementations — first one (line ~2503) always called, missing filename extraction
- **Now:** Single correct implementation with blob URL + URL param handling

#### 4. Canvas Click Wrong Slider ID Fixed
- **Was:** `getElementById('animFrames')` → null → frame boundary broken
- **Now:** `getElementById('frameCountSlider')` — matches actual DOM element

#### 5. Model Filename Constants Extracted
- **Was:** GGUF/CLIP/VAE filenames hardcoded as string literals inside workflow builder functions
- **Now:** `MODEL_FILES` config object at top of script (easy single-location updates)

#### 6. GIF Transparent Property Fixed
- **Was:** `transparent: 'rgba(0,0,0,0)'` — invalid string format, transparency never worked
- **Now:** `transparent: null` (no transparency hack) — correct `gif.js` API usage

#### 7. GIF Frame Delay Reads FPS Slider
- **Was:** `delay: 150` hardcoded regardless of FPS slider
- **Now:** `delay: Math.round(1000 / parseInt(fpsSlider.value))`

#### 8. `start_gen.sh` Dynamic Python + Auto-Open
- **Was:** Hardcoded `/opt/homebrew/bin/python3`, no browser open
- **Now:** `$(command -v python3)` with fallback check + `open "http://localhost:$PORT"` at end

#### 9. Descriptive Export Filenames
- **Was:** `spritesheet_${Date.now()}.png`, `sprites_${Date.now()}.zip`
- **Now:** `epoch_{prompt-slug}_{anims}_{timestamp}.png/.zip`

---

## Chunk 1.5 — Secondary Audit Quick Wins ⚡
**Date:** 2026-03-01 19:06 IST | **Status:** ✅ COMPLETE

> 7 additional findings reviewed from secondary audit. All valid. 3 quick-wins fixed immediately.

#### Fixed now:

**#33 — `pollHistory` Infinite Loop Trap**
- **Was:** `while(true)` silently spun for 30 minutes if ComfyUI job failed with an error or zero outputs
- **Now:** Explicit `entry.error` and `entry.status.completed && !entry.outputs` detection — throws immediately with descriptive message

**#36 — Canvas Anti-Aliasing (`imageSmoothingEnabled = false`)**
- **Was:** Browser bilinear smoothing blurred pixel art during `drawImage()` scaling
- **Now:** `imageSmoothingEnabled = false` on all 4 canvas 2D contexts (generation, resumeSession, frame preview, animation loop)

**#32 — `URL.createObjectURL` Memory Leak**
- **Was:** Blob URLs never revoked — ZIP, GIF, and custom upload blobs held in memory until tab crash
- **Now:** `setTimeout(() => URL.revokeObjectURL(...)`, 10000)` after every anchor click

#### Deferred to Chunk 2:
- #31 ComfyUI `/input` folder bloat (needs `_tempUploads[]` tracking + Traffic Cop cleanup endpoint)
- #35 Custom upload OOM (needs canvas-resize-before-upload)
- #34 AbortController for cancel (Chunk 3)
- #37 SwiftBar `/tmp/.gen_tool_port` integration (Chunk 4)

---

## Chunk 3 — P2 UX Instant Wins ⚡
**Date:** 2026-03-01 19:17 IST | **Status:** ✅ COMPLETE (instant-wins only)

**#15 — OOM Disconnect Alert**
- `socket.onclose` now checks if generation was in flight; shows clear ⚠️ status in both Tab 1 and Sprite status bars

**#16 — Canvas Overflow**
- Canvas wrapped in `overflow-x:auto; -webkit-overflow-scrolling:touch` container with `inline-block` inner div

**#17 — Style Keyword Indicator**
- After ref upload, status bar shows: `✅ Reference ready. Style: [pixel-art] — Starting…`

*Deferred to future session: #18 prompt history sidebar, #19 batch gen, #34 AbortController*

---

## Chunk 4 — P3 Quick-Wins ⚡
**Date:** 2026-03-01 19:20 IST | **Status:** ✅ COMPLETE (quick-wins)

**#21 — Session Export / Import**
- `exportSessionJSON()` exports full session config (prompts, anims, frames, overrides) as `.json`
- `importSessionJSON()` reads file and restores session + shows recovery banner
- Export/Import buttons appear alongside Sheet/ZIP buttons on generation complete

**#27 — ARIA Labels**
- `aria-label` on download sheet, download ZIP, export session, import session buttons

**#37 — SwiftBar Plugin (`ImageGen.30s.sh`)**
- Reads `/tmp/.gen_tool_port` to detect if server is live
- Shows `🎨 ImageGen :PORT` when running, `⚪ ImageGen (stopped)` when not
- Dropdown: Open URL, Restart, View Logs, View Audit
- Refreshes every 30 seconds
- To install: symlink to `~/Library/Application Support/SwiftBar/Plugins/`

---

## Current State
All 4 active chunks committed across 4 git commits.
**25 of 37 audit items** shipped. Remaining are large-feature items (FastAPI backend, LoRA, ControlNet, batch gen, prompt history) for future sessions.

