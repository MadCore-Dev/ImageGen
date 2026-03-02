# ImageGen Codebase Audit - To-Do List

## 🚨 1. Critical Blockers & State Freezes
- [x] Fix Broken Loader Wrap State (UI Freeze) in `js/sprite_engine.js` (change `.active` to `.visible`)
- [x] Fix Hardcoded AnimateDiff Models in `js/video_engine.js` and `js/config.js`

## 🐛 2. Logic & State Management Bugs
- [x] Fix Broken State on Single-Cell Retry in `js/canvas.js` (update `session.completedFrames` & chained reference image)
- [x] Fix Row Retry Persistence Bug in `js/canvas.js` (call `saveSession()`)
- [x] Fix LoRA Support Restriction in `js/workflows.js` (remove `type === 'gguf'` wrapper for LoraLoader)
- [x] Fix Sprite Engine Model Fallback Flaw in `js/sprite_engine.js`
- [x] Fix Cross-Pollution of Variables in `js/app.js` (Implemented `activePromptIds` routing in `api.js`)

## 📉 3. Performance & Resource Risks
- [x] Fix Canvas Squashing & img2img Sizing in `js/canvas.js` (nearest-neighbor interpolation `ctx.imageSmoothingEnabled = false;` & upscale img2img to 768x768)
- [x] Fix Massive VRAM Bloat / Temp File Leak in `js/sprite_engine.js` (Optimized via recursion scaling)
- [x] Fix Memory Leak via Object URLs in `js/canvas.js` (Added `URL.revokeObjectURL` cleanup)

## 🏗️ 4. Architectural & Systemic Smells
- [x] Fix Global Variable Mutations in `js/config.js` (use set functions instead of direct mutation)
- [x] Fix Brittle Polling Logic in `js/api.js` (avoid using UI button state to infer backend state)
- [x] Fix Unreliable Clipboard Fallback in `js/ui.js` (executed `document.execCommand('copy')`)
- [x] Fix XSS Risks via LocalStorage in `js/session.js` (use `textContent` instead of `innerHTML`)

## 🎨 5. UI/UX & Quality of Life
- [x] Graceful Degradation for Traffic Cop (handle fetch connection refused with a friendly UI note)
- [x] Fix Ghost "Cancel" Button in `js/app.js`
- [x] Fix CSS Class Typo in `css/styles.css` (remove inline opacity on `.btn-approve:disabled`)
- [x] Fix Responsive Breakpoints in `css/styles.css` (add `minmax(100px, 1fr)`)
- [x] Fix Empty State Shimmer Visibility in `css/styles.css` (adjust shimmer for low contrast)

## ⚙️ 6. Local Network Testing & Scripts
- [x] Fix Web Worker Pathing (Ensure `gif.worker.js` is served correctly)
