# 🎨 Project Epoch: ImageGen Tool — Full Code Audit

> **Audit Date:** 2026-03-01 | **Reviewer:** Independent + Original Notes
> **File Scope:** `index.html` (3,656 lines), `start_gen.sh`, project structure
> **Verdict:** A highly capable, beautifully designed offline AI pipeline — but deeply monolithic with several genuine crash-level bugs still live in the codebase.

This is a highly impressive and incredibly practical offline tool. You've built a bespoke, highly functional front-end that bridges the gap between complex ComfyUI workflows and a streamlined game development pipeline. The integration of a "Traffic Cop" for hardware management, alongside local generative pipelines for Project Epoch, shows a deep understanding of optimizing local resources for asset creation.

However, as a project scales—especially a tool meant to generate production-ready assets—it accumulates technical debt. The current state is highly monolithic (one 141KB HTML file), which makes debugging and extending features difficult.

---

## 🔴 P0 — Critical Crashes & Silent Data Loss

These are confirmed bugs in the current code that will cause crashes, data loss, or completely broken functionality.

### 1. `animDefinitions` is Undefined in `retryActiveCell()` — **ACTIVE CRASH**

- **Location:** `retryActiveCell()` — line ~3601
- **The Bug:** `animDefinitions[animId]` is referenced but `animDefinitions` is **never defined anywhere in the codebase**. This is a stale variable from a previous refactor. Every single "Retry Frame" click throws a `ReferenceError: animDefinitions is not defined` and the catch block silently swallows it.
- **The Fix:** Replace `animDefinitions[animId]` with a lookup against the existing `ANIMATION_PRESETS` array, which is the correct source of truth:
  ```js
  const preset = ANIMATION_PRESETS.find(p => p.id === animId);
  const animPrompt = preset ? `${document.getElementById('spritePrompt').value.trim()}, ${preset.keyframes?.[frameIndex % preset.keyframes.length] || preset.pose}` : '';
  ```

### 2. `retryActiveCell()` Uses Wrong Prompt Source — **Logic Bug**

- **Location:** `retryActiveCell()` — line ~3605-3606
- **The Bug:** It reads the negative prompt from `#negativeInput` (the Tab 1 Image Gen textarea) instead of building the sprite negative keywords. The signature is also wrong: `buildImg2ImgWorkflow(uploadName, animPrompt, positivePrompt, negativePrompt)` — the 3rd argument is being passed `promptInput.value` which would inject the *positive* prompt as the negative!
- **The Fix:** Use `activeStyleKw.negative` or the sprite negative keyword string, and fix the argument order to match the actual function signature.

### 3. `approveReference()` is Declared Twice — **Silent Override**

- **Location:** Lines 2503 and 3000
- **The Bug:** There are two completely different implementations of `approveReference()`. The second one at line 3000 (which has the proper blob URL handling) **silently overrides** the first. This is a refactoring remnant. The first version (line 2503) only does `style.display = 'block'` / `scrollIntoView` and sets no `referenceImageFilename`. If the first one were ever called, stage 3 would fail silently because `referenceImageFilename` would be `null`.
- **The Fix:** Delete the first incomplete version (lines 2503-2507), keeping only the complete implementation at line 3000.

### 4. LocalStorage Quota Exceeded — Session Recovery Crash *(from original audit, still unimplemented)*

- **Location:** `saveSession()` — line ~3277
- **The Bug:** Every frame save calls `canvas.toDataURL()` and stores the full base64 PNG in `localStorage`. A 64×8 frame sprite sheet at 512px cells = 4096×512px canvas. That's well over 5MB when encoded as base64. This will throw `QuotaExceededError` mid-generation, killing the session recovery feature entirely.
- **The Fix:** Store only the `completedFrames` filenames array (which are just filename strings) in `localStorage`. Restore the canvas at recovery time by fetching each image back from `http://${COMFY_API}/view?filename=...`. OR use `IndexedDB` via `localForage` for the blob storage.

### 5. Canvas Click Uses Wrong Slider ID — **P0 for frame detection**

- **Location:** Line ~3375
- **The Bug:** The canvas click handler reads `document.getElementById('animFrames').value` but the slider's actual ID throughout the rest of the file is `frameCountSlider`. This `getElementById` returns `null`, `.value` throws, and frame boundary clamping breaks — clicking the canvas may open the wrong cell preview or fail silently.
- **The Fix:** Replace `animFrames` with `frameCountSlider` to match the actual DOM element ID.

### 6. Hardcoded User Paths and IPs *(from original audit, still unimplemented)*

- **Location:** Lines 1648–1649, header HTML line ~1222
- **The Bug:** `TRAFFIC_COP`, `COMFY_API`, and the output folder path are hardcoded to `127.0.0.1:5050`, `127.0.0.1:8188`, and `/Users/manojsamal/.ComfyUI/output`. If any of these change, the tool silently breaks with confusing network errors.
- **The Fix:** A settings modal that reads/writes these to `localStorage` on startup. Auto-populate as defaults if nothing stored.

### 7. Hardcoded Model Filenames in Workflows *(from original audit, still unimplemented)*

- **Location:** `buildWorkflow()` and `buildImg2ImgWorkflow()` — lines ~1990–2067
- **The Bug:** GGUF model names (`flux1-schnell-Q4_K_S.gguf`, `t5xxl_fp8_e4m3fn.safetensors`, etc.) are hardcoded strings inside the workflow builder. If you update a model version, you must dig through JS string literals to find and fix them.
- **The Fix:** Extract model filename constants to a config object at the top of the script. Eventually, fetch from `/object_info` to dynamically populate.

---

## 🟠 P1 — Architecture & Code Quality (High Priority)

### 1. 3,656-Line Monolith — Everything in `index.html`

The entire app — 1,200+ lines of CSS, complex DOM structure, and 2,000+ lines of JavaScript — lives in a single HTML file. There are 8 animation preset objects, 4 workflow builders, WebSocket management, canvas drawing logic, ZIP generation, GIF encoding, and session persistence all interleaved with no separation of concerns.

**Proposed restructure:**
```
ImageGen/
├── index.html          # Clean DOM skeleton only
├── css/
│   └── styles.css      # All design tokens and component styles
├── js/
│   ├── app.js          # DOMContentLoaded init, event bindings
│   ├── config.js       # COMFY_API, TRAFFIC_COP, MODEL_SPECS, STYLE_MAP, ANIMATION_PRESETS
│   ├── services/
│   │   ├── comfy.js    # fetch/WebSocket wrappers, pollHistory, uploadImage
│   │   └── trafficcop.js # TrafficCop health + wake logic
│   ├── workflows/
│   │   ├── txt2img.js  # buildWorkflow()
│   │   └── img2img.js  # buildImg2ImgWorkflow()
│   ├── sprite/
│   │   ├── generator.js  # generateSpriteRef(), startAnimationQueue()
│   │   ├── canvas.js     # All canvas drawing, cell click, retry logic
│   │   ├── session.js    # saveSession, loadSession, resumeSession
│   │   └── export.js     # downloadSpriteSheet, downloadFramesZip, exportGif
│   ├── ui/
│   │   ├── tabs.js     # switchTab(), setTabActivity()
│   │   ├── status.js   # setStatus(), setProgress(), setSpriteStatus()
│   │   └── style.js    # selectStyle(), clearStyle() + STYLE_MAP
│   └── imagegen.js     # generateImage(), downloadImage()
├── workflows/          # Raw ComfyUI JSON exports
│   ├── flux_txt2img.json
│   ├── sdxl_txt2img.json
│   └── sd15_img2img.json
├── vendor/             # gif.js, gif.worker.js, jszip.min.js
└── start_gen.sh
```

### 2. Sprite Queue Uses `selectedAnimations` Global, Not Local `selectedAnims`

- **Location:** `startAnimationQueue()` — line ~3126 and ~3176
- **The Bug:** The timeline rows are built from `selectedAnimations` (the module-level global) instead of the local `selectedAnims` constant computed at the top of the function via `getCheckedAnimIds()`. If the user had previously toggled animations and not re-confirmed, `selectedAnimations` may be stale — causing row count mismatches with the canvas grid.
- **The Fix:** Use `selectedAnims` (local) consistently for all DOM building and loop execution within `startAnimationQueue`.

### 3. Duplicated Inline Style Code (CSS Anti-Pattern)

- The `startAnimationQueue()` and `resumeSession()` functions build timeline row `<div>` elements with ~10 inline `style` properties each and duplicate this logic completely.
- The `renderPoseOverrides()` also builds inputs with inline styles.
- **The Fix:** Extract these into CSS classes (`.timeline-row`, `.timeline-frame-counter`, `.pose-override-row`) and use `className` assignments.

### 4. Workflow JSON Abstraction *(from original audit, still unimplemented)*

The `buildWorkflow()` function produces 8-node inline JS objects manually. This is brittle — a ComfyUI update that changes a node's class name or input key breaks the whole thing silently (queuing succeeds but generates nothing).

- **The Fix:** Export working workflows from ComfyUI's UI directly as `.json` files. Load them via `fetch('./workflows/flux_txt2img.json')`, then inject dynamic values (seed, steps, CFG, prompts) into the parsed object. This makes updating for new ComfyUI versions a JSON file edit, not a JS surgery.

---

## 🟡 P2 — UX & Functional Gaps (Medium Priority)

### 1. GIF Export: `transparent` Property is Wrong Format

- **Location:** `exportActiveAnimationGif()` — line ~3557
- **The Bug:** `transparent: 'rgba(0,0,0,0)'` is not a valid value for `gif.js`. The `transparent` option expects a hex color integer like `0x00FF00` (the color to treat as transparent), not an RGBA string. This doesn't crash but transparency never works — exported GIFs always have a solid background.
- **The Fix:** Either pass `null` for no transparency, or use `0xFFFFFF` if the background is white and set `background: '#ffffff'` as well. Or expose a "transparent background" toggle in the UI.

### 2. Hardware Awareness / OOM Handling *(from original audit, extended)*

- **Current State:** The WebSocket has 5 max retries with exponential backoff, and `pollHistory` times out after 30 minutes of WebSocket silence.
- **Still Missing:** If ComfyUI crashes mid-generation (common OOM scenario on Apple Silicon with FLUX), the WS `onclose` fires but there's no explicit user alert distinguishing "connection dropped" from "ComfyUI crashed." The user sees no status update until the 30-minute timeout.
- **The Fix:** Track `lastComfyActivity`. If WS closes *while* `pollHistory` is active (i.e., during generation), immediately show an error toast: *"⚠️ ComfyUI disconnected during generation. Possible OOM. Attempting Traffic Cop restart…"* and auto-call `/comfyui/start`.

### 3. `start_gen.sh` — Hardcoded Python Path

- **Location:** `start_gen.sh` — lines 16, 22
- **The Bug:** `/opt/homebrew/bin/python3` is hardcoded. On systems where Python is installed elsewhere (via pyenv, conda, or macOS system Python) or if Homebrew moves its prefix, the script silently does nothing or errors.
- **The Fix:** Use `$(command -v python3)` to dynamically resolve the Python path. Add a check: `if ! command -v python3 &>/dev/null; then echo "❌ python3 not found"; exit 1; fi`.

### 4. `start_gen.sh` — No Open-Browser Step

- **The Bug:** After starting the server, the user has to manually look up the port from the log file and type the URL. The port is already known at script time.
- **The Fix:** Add `open "http://localhost:$PORT"` at the end of the script so macOS opens the tool automatically when run.

### 5. No Prompt Validation for Empty Sprite Gen

- **Location:** `generateSpriteRef()` top
- There is a `userPrompt` empty check, but the style keywords from Tab 1 can bleed into sprite gen silently (photorealistic keywords applied to a pixel art sprite render). The user gets no feedback about what style keywords are being injected.
- **The Fix:** In the sprite tab's generation status bar, show a small "Using style: [Pixel Art]" indicator pill so the user knows what keywords are being applied.

### 6. Sprite Canvas is Not Responsive / Overflows on Small Screens

- The canvas width is computed as `activeSpriteSize * framesCount`. For a 512px sprite with 8 frames, that's a 4096px wide canvas. There's no horizontal scroll wrapper or `transform: scale()` to contain it.
- **The Fix:** Wrap the canvas in an `overflow-x: auto` container and add `max-width: 100%` on the canvas's parent.

### 7. Prompt History & Gallery *(from original audit, still unimplemented)*

- Every refresh loses the current prompt. History across sessions is zero.
- **The Fix:** After each successful generation, push a record `{ prompt, seed, cfg, steps, model, timestamp, filename }` to an array in `localStorage` (keep the last 30). Add a collapsible "History" sidebar that renders thumbnails from `http://${COMFY_API}/view?filename=...`. Click to re-populate inputs.

### 8. No Batch Generation (Tab 1)

- You can only generate one image at a time. To explore variations, you click Generate, wait, compare, repeat.
- **The Fix:** Add a "Batch Size" input (1–4). Queue multiple prompts in sequence (using a different seed for each), collect all filenames, and display them in a small grid below the main result. User can click any thumbnail to set it as the "active" download.

---

## 🟢 P3 — Advanced Features & Future Polish

### 1. ControlNet Integration for Sprite Consistency ~~(*Removed — Unity-specific*)~~

> This was designed around using Unity ProBuilder depth maps as ControlNet conditioning inputs. Without Unity as part of the pipeline, there is no practical source for frame-accurate depth maps. Removed.

### 2. Python Backend (`start_gen.sh`) — FastAPI Upgrade ~~(*Removed — moot*)~~

> All the concrete problems this was meant to solve have been addressed: ComfyUI/TrafficCop config is now in `localStorage` (fix #6), the `/status` endpoint is replaced by `/tmp/.gen_tool_port` (fix #37), and `POST /save-sprite` was only needed for #25 (removed). The static `python3 -m http.server` is sufficient for a solo local tool.

### 3. Native "Send to Unity" Button *(from original audit)*

- **Upgrade:** A button that sends the sprite sheet to the FastAPI backend, which slices the sheet and saves individual PNGs directly into the configured Unity `Assets/Textures/Sprites/` path — with auto-generated `.meta` files using Unity's default sprite import settings.

### 4. LoRA Support in Workflows

- Currently there's no LoRA loading node in any workflow. The "Pixel Art" style relies purely on text prompting FLUX — LoRA fine-tuning for pixel art would dramatically improve output consistency.
- **Upgrade:** Add a `LoraLoader` node to the GGUF workflow chain with a configurable LoRA dropdown in the Advanced Settings panel.

### 5. CSS Custom Properties Not Fully Leveraged for Theming

- The design token system (`:root { --bg-deep, --accent, etc. }`) is well-structured, but the theme is hardcoded dark. There's no way to override it.
- **Upgrade:** Add a theme switcher that writes to `data-theme` on `<html>`, allowing at minimum a "lighter dark" variant. Export the CSS tokens to a standalone `tokens.css` file so they're reusable outside the HTML.

### 6. No Accessibility (a11y) for Core Actions

- The Generate button, model chips, and style chips have no `aria-label` or `aria-pressed` attributes. The canvas is not keyboard-navigable.
- **Upgrade:** Add `role="radio"` + `aria-checked` to model/style chips. Add `aria-label` to icon buttons (`🔀`, `🔒`). Add `aria-live="polite"` to the status bar so screen readers announce generation state.

### 7. WebSocket Connection Not Traffic-Cop Aware

- The WebSocket connects to ComfyUI directly at startup (`initWebSocket()` is called at page load implicitly through the first generate). If ComfyUI isn't running yet, the WS connection attempt fails and `wsRetries` counts toward the 5-retry limit before ComfyUI is even started via Traffic Cop.
- **The Fix:** Only call `initWebSocket()` *after* a successful Traffic Cop `/comfyui/start` response, not on page load. Reset `wsRetries = 0` at that point.

### 8. No Export of Session Config / Re-import

- If you close the browser and `localStorage` is cleared (private mode, browser reset), the entire sprite session is gone with no human-readable backup.
- **Upgrade:** Add "Export Session JSON" and "Import Session JSON" buttons in the sprite sheet UI. The export includes prompts, animation types, frame count, denoise settings, and completed frame filenames so you can at minimum recreate the run config.

### 9. GIF Export Uses Fixed 150ms Delay, Ignores FPS Slider

- **Location:** `exportActiveAnimationGif()` — line ~3567
- **The Bug:** `gif.addFrame(tempCanvas, { delay: 150 })` hardcodes 150ms per frame. The live preview FPS slider is ignored entirely.
- **The Fix:** Compute delay from the FPS slider: `const delay = Math.round(1000 / parseInt(document.getElementById('fpsSlider').value)); gif.addFrame(tempCanvas, { delay });`

### 10. Sprite Sheet Download Filename is Not Descriptive

- `spritesheet_${Date.now()}.png` — unusable when you have dozens of these. Same for `sprites_${Date.now()}.zip`.
- **The Fix:** Build the filename from the prompt + animation IDs: `epoch_${userPrompt.slice(0, 20).replace(/\s/g,'_')}_walk_run_${Date.now()}.png`.

---

## 🟠 P1 — Secondary Audit Findings (High Priority)

### 5. ComfyUI Input Folder Disk Bloat (Silent Space Leak)

- **Location:** `startAnimationQueue()`, `retryActiveCell()`
- **The Bug:** Every frame in the sequential queue does `uploadImageToComfy(blob, 'recur_${animId}_${c}_${Date.now()}.png')` to chain frames as recursive references. A single 6-animation × 8-frame run uploads **48 temporary PNGs** into ComfyUI's `/input` folder with no cleanup mechanism. Over days of use, this silently fills the drive with gigabytes of `recur_*` and `sprite_ref_*` files.
- **The Fix:** Track uploaded temp filenames in a `_tempUploads[]` array during the generation run. On completion or cancel, POST a cleanup request to Traffic Cop (need a `/cleanup-inputs` endpoint) to delete them, or at minimum log the list so the user can clean manually.

### 6. Browser Object URL Memory Leak

- **Location:** `downloadFramesZip()`, `exportActiveAnimationGif()`, `handleCustomUpload()`
- **The Bug:** `URL.createObjectURL(blob)` is called but `URL.revokeObjectURL()` is **never called**. Every ZIP download, GIF export, and custom upload pins a blob in browser memory. Over a long sprite generation session, the tab RAM balloons until it crashes.
- **The Fix:** Add `setTimeout(() => URL.revokeObjectURL(a.href), 10000)` after each anchor click. For `handleCustomUpload`, revoke the previous `imgEl.src` object URL before setting the new one.

---

## 🟡 P2 — Secondary Audit Findings (Medium Priority)

### 10. `pollHistory` Infinite Loop Trap

- **Location:** `pollHistory()` — the `while(true)` loop
- **The Bug:** If ComfyUI records the `prompt_id` in history but the job failed (OOM, missing model, node error), the history entry contains an `error` key or a `status.completed = true` with no `outputs`. The loop will spin for the full 30-minute inactivity timeout showing ⏳, even though the backend failed in seconds.
- **The Fix:** Check for the error path explicitly inside the loop:
  ```js
  const entry = history[prompt_id];
  if (entry?.status?.completed && !entry.outputs) throw new Error('ComfyUI job completed with no output — likely a node error or missing model.');
  if (entry?.error) throw new Error(`ComfyUI error: ${entry.error}`);
  ```

### 11. Cancel Button Doesn't Abort In-Flight Requests

- **Location:** `cancelAnimationQueue()`, `startAnimationQueue()`
- **The Bug:** `cancelGenerationFlag = true` is checked only *before* each new frame starts. If cancel is clicked mid-generation, the UI is stuck waiting for the current `await pollHistory()` + `await fetch` to finish — which could be 2–5 minutes for SDXL.
- **The Fix:** Use an `AbortController`. Create one at the start of `startAnimationQueue`, pass its `signal` to all `fetch()` calls and to `pollHistory`, and call `controller.abort()` inside `cancelAnimationQueue()` for instant teardown.

### 12. Custom Upload OOM — No Resolution Cap

- **Location:** `handleCustomUpload()`
- **The Bug:** A user can upload any resolution PNG (e.g., a 4K screenshot from their desktop). The raw file is sent straight to ComfyUI's `VAEEncode` node, which will attempt to encode the full 4K image, instantly OOM-crashing the ComfyUI process on Apple Silicon.
- **The Fix:** Before upload, draw the image to a hidden `<canvas>` clamped to `Math.min(activeSpriteSize * 4, 1024)` and export it back as a Blob — ensuring ComfyUI never receives an oversized reference.

---

## 🟢 P3 — Secondary Audit Polish

### 11. Canvas Anti-Aliasing During `drawImage()`

- **Location:** All `canvas.getContext('2d')` calls in sprite generation, export, and preview
- **The Bug:** CSS `image-rendering: pixelated` only controls *display* rendering. When `drawImage()` downscales a 512px AI output into a 64px canvas cell, the browser's 2D context applies internal bilinear smoothing by default — producing blurry, blended pixel art.
- **The Fix:** Set `ctx.imageSmoothingEnabled = false` immediately after every `canvas.getContext('2d')` call. One line per context, massive visual quality improvement.

### 12. Port Config & SwiftBar Integration

> **⚠️ SwiftBar-Specific Note:** This one is directly relevant since the tool will be triggered from a SwiftBar plugin.

- **Context:** `start_gen.sh` already writes the dynamic HTTP port to `/tmp/.gen_tool_port`. ComfyUI and Traffic Cop ports are hardcoded in JS. Your SwiftBar plugin should:
  1. Call `start_gen.sh` (already starts server + auto-opens browser via our fix)
  2. Read `cat /tmp/.gen_tool_port` to know the URL for status pinging
  3. Ping `http://localhost:$(cat /tmp/.gen_tool_port)` to confirm the tool server is live
- **Additional Fix:** Rather than a `config.js` file (fragile on cold-start race conditions), the better path is the **Settings modal** (Chunk 2, item #6) — user sets ComfyUI/Traffic Cop addresses once, they persist in `localStorage`. The SwiftBar plugin itself only needs to manage the HTTP server port, which it already gets from `/tmp/.gen_tool_port`.

---

## 📋 Implementation Checklist (Ordered by Priority)

| # | Item | Priority | Effort | Status |
|---|------|----------|--------|--------|
| 1 | Fix `animDefinitions` undefined crash in `retryActiveCell` | 🔴 P0 | 15min | ✅ Done |
| 2 | Fix wrong prompt arg order in `retryActiveCell` | 🔴 P0 | 15min | ✅ Done |
| 3 | Delete duplicate `approveReference()` definition | 🔴 P0 | 5min | ✅ Done |
| 4 | Fix canvas click using wrong slider ID (`animFrames` → `frameCountSlider`) | 🔴 P0 | 5min | ✅ Done |
| 5 | Replace `localStorage` canvas blob with filename-only session + fetch-on-restore | 🔴 P0 | 2hr | ✅ Done |
| 6 | Settings modal for ComfyUI/TrafficCop addresses + output path | 🔴 P0 | 2hr | ✅ Done |
| 7 | Extract model filename literals to config constants | 🔴 P0 | 30min | ✅ Done |
| 8 | Use `selectedAnims` (local) consistently in `startAnimationQueue` | 🟠 P1 | 20min | ✅ Done |
| 9 | Extract timeline row DOM generation to a reusable function (kill inline styles) | 🟠 P1 | 1hr | ✅ Done |
| 10 | Split into multi-file project structure (`js/`, `css/`) | 🟠 P1 | 4hr | ⏳ Future |
| 11 | Load ComfyUI workflows from static JSON files | 🟠 P1 | 3hr | ⏳ Future |
| 12 | Fix GIF `transparent` property format issue | 🟡 P2 | 10min | ✅ Done |
| 13 | GIF export: read delay from FPS slider instead of hardcoded 150ms | 🟡 P2 | 10min | ✅ Done |
| 14 | `start_gen.sh`: dynamic Python path + auto `open` URL | 🟡 P2 | 15min | ✅ Done |
| 15 | OOM crash detection: alert + auto Traffic-Cop restart on WS drop during gen | 🟡 P2 | 1hr | ✅ Done |
| 16 | Canvas overflow fix: horizontal scroll container | 🟡 P2 | 20min | ✅ Done |
| 17 | Sprite gen: show injected style keywords in status bar | 🟡 P2 | 20min | ✅ Done |
| 18 | Prompt history sidebar (last 20, with thumbnails) | 🟡 P2 | 3hr | ✅ Done |
| 19 | Batch generation (1–4 images) for Tab 1 | 🟡 P2 | 2hr | ✅ Done |
| 20 | Only call `initWebSocket()` after successful Traffic Cop response | 🟢 P3 | 20min | ✅ Done |
| 21 | Session export/import as JSON | 🟢 P3 | 2hr | ✅ Done |
| 22 | Descriptive filenames for sprite sheet + ZIP exports | 🟢 P3 | 15min | ✅ Done |
| 23 | LoRA support in GGUF workflow | 🟢 P3 | 2hr | ⏳ Future |
| 29 | Drag-and-drop frame reordering in preview modal | 🟢 P3 | 3hr | ⏳ Future |
| 30 | CSS skeleton loaders + cycling tips during generation | 🟢 P3 | 2hr | ⏳ Future |
| 31 | ComfyUI `/input` folder cleanup after generation (disk bloat) | 🟠 P1 | 2hr | ✅ Done |
| 32 | Revoke `URL.createObjectURL` blobs after use (memory leak) | 🟠 P1 | 20min | ✅ Done |
| 33 | `pollHistory` infinite loop trap on ComfyUI node errors | 🟡 P2 | 30min | ✅ Done |
| 34 | AbortController for cancel button (actually stops in-flight fetch) | 🟡 P2 | 2hr | ✅ Done |
| 35 | Custom upload resolution cap (prevent OOM from 4K uploads) | 🟡 P2 | 1hr | ✅ Done |
| 36 | `imageSmoothingEnabled = false` on all canvas 2D contexts | 🟢 P3 | 15min | ✅ Done |
| 37 | SwiftBar plugin — `ai_manager.3s.sh` updated with View Logs shortcut | 🟢 P3 | 30min | ✅ Done |
| 27 | Accessibility: aria-label, aria-checked, aria-live | 🟢 P3 | 1hr | ✅ Done |
| 28 | CSS theme switcher (data-theme, token export) | 🟢 P3 | 1hr | ✅ Done |

---

> **Quick Wins Today (Under 30 minutes total):**
> Items 1, 2, 3, 4, 7, 12, 13, 14, 22 can all be fixed in a single focused coding session and would eliminate all P0 crashes.