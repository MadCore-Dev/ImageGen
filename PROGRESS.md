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

---

## Chunk 2 — P0/P1 Structural Fixes ⚡
**Date:** 2026-03-01 19:10 IST | **Status:** ✅ COMPLETE

**#5 — localStorage Session Fix (P0)**
- `saveSession()` no longer stores `canvas.toDataURL()` blobs — only filename strings
- Canvas restored from ComfyUI `/view?filename=...` at resume time

**#6 — Settings Modal**
- Persistent ComfyUI + Traffic Cop address config via `localStorage`
- Modal with Save/Cancel, keyboard Escape support

**#8 — `selectedAnims` Consistency**
- Replaced stale `selectedAnimations` global with local `selectedAnims` in `startAnimationQueue`

**#9 — Timeline Row Builder**
- `buildTimelineRow()` helper extracted — replaces all inline-style DOM building

**#20 — WebSocket Init Deferred**
- `initWebSocket()` now only called after Traffic Cop confirms ComfyUI is up

**#31 — Temp Upload Tracking**
- `_tempUploads[]` tracks every recursive frame upload; logged on completion

**#35 — Custom Upload OOM**
- `handleCustomUpload()` resizes images to safe resolution before sending to ComfyUI

**Global Replace:** `COMFY_API_LIVE` / `TRAFFIC_COP_LIVE` wired to all 18 fetch/WS call sites via `sed`

---

## Chunk 3 — P2 UX Instant Wins ⚡
**Date:** 2026-03-01 19:17 IST | **Status:** ✅ COMPLETE (instant-wins only)

**#15 — OOM Disconnect Alert**
- `socket.onclose` now checks if generation was in flight; shows clear ⚠️ status in both Tab 1 and Sprite status bars

**#16 — Canvas Overflow**
- Canvas wrapped in `overflow-x:auto; -webkit-overflow-scrolling:touch` container with `inline-block` inner div

**#17 — Style Keyword Indicator**
- After ref upload, status bar shows: `✅ Reference ready. Style: [pixel-art] — Starting…`

*Deferred: #18, #19, #34 were originally deferred but all are now done — see below*

---

## Chunk 4 — P3 Quick-Wins ⚡
**Date:** 2026-03-01 19:20 IST | **Status:** ✅ COMPLETE (quick-wins)

**#21 — Session Export / Import**
- `exportSessionJSON()` exports full session config (prompts, anims, frames, overrides) as `.json`
- `importSessionJSON()` reads file and restores session + shows recovery banner
- Export/Import buttons appear alongside Sheet/ZIP buttons on generation complete

**#27 — ARIA Labels**
- `aria-label` on download sheet, download ZIP, export session, import session buttons

**#37 — SwiftBar (corrected)**
- Removed erroneous `ImageGen.30s.sh` from project root
- Updated existing `SwiftBarPlugins/ai_manager.3s.sh` instead (already had start/stop/port logic)
- Added `📋 View Server Logs` shortcut to Gen Tool active-state dropdown

---

## Chunk 3 Remainder — AbortController ⚡
**Date:** 2026-03-01 19:30 IST | **Status:** ✅ COMPLETE | **Commit:** `e196195`

**#34 — AbortController for Cancel**
- `_generationAbortController` created fresh each queue run
- `cancelAnimationQueue()` calls `.abort()` immediately
- `abortSignal` passed to prompt fetch AND `pollHistory`
- `pollHistory(prompt_id, signal=null)`: checks `signal.aborted` at top of every loop
- `DOMException('AbortError')` thrown and caught cleanly — no more 2-5min hang after cancel

---

## Chunk 4 Remainder — Batch Gen + Theme Switcher ⚡
**Date:** 2026-03-01 19:33 IST | **Status:** ✅ COMPLETE | **Commit:** `15ea36a`

**#19 — Batch Generation**
- Batch count pill selector (1-4) above Generate button
- `setBatchCount()` toggles active pill, updates button label
- `generateImage` overridden to run n sequential generations
- `batchGrid` cards show each result with individual ⬇ download buttons
- Per-card error display if any single run fails

**#28 — Theme Switcher**
- `[data-theme="light"]` CSS vars override dark-mode defaults
- `toggleTheme()` sets `data-theme` on `<html>`, persists to `localStorage`
- `applyTheme()` called at `DOMContentLoaded` for instant restore
- 🌙/☀️ toggle button in header alongside Settings

---

## Chunk 5 — Prompt History Sidebar ⚡
**Date:** 2026-03-01 19:35 IST | **Status:** ✅ COMPLETE | **Commit:** `f5efcd8`

**#18 — Prompt History**
- `HISTORY_KEY` localStorage stores last 20 prompts, deduplicated by text
- `savePromptHistory(prompt, thumbUrl)` called on `imgEl.onload` with ComfyUI image URL
- `renderPromptHistory()` builds collapsible panel with 36px thumbnails
- `restoreFromHistory(idx)` fills `promptInput` and collapses panel
- `toggleHistoryPanel()` ▼/▲ chevron toggle; `clearPromptHistory()` removes key
- Panel hidden when empty, auto-shown when history exists
- `renderPromptHistory()` called at `DOMContentLoaded`

---

## Current State
**6 chunks committed across 7 git commits** (includes SwiftBar fix commit).

**32 of 36 audit items shipped** (#25 Send-to-Unity removed by user request).

| Remaining | Notes |
|-----------|-------|
| `#10` Modularization | Full file split — large session |
| `#11` Workflow JSON | Fetch-based workflow loading |
| `#23` LoRA support | GGUF workflow additions |
| `#24` FastAPI backend | Backend rewrite |
| `#26` ControlNet | Major workflow addition |
| `#29` Drag-drop reorder | Frame reordering UI |
| `#30` Skeleton loaders | CSS animation polish |
