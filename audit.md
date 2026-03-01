# Tab 3 — Animate: Task Board

> Branch: `dev/tab3_videogen_01032026`
> This file replaces the old completed audit items.

## Phase 0 — Prerequisites
- [x] Add AnimateDiff model dir + motion module to `download_essential_models.sh`
- [x] Run download script, verify `mm_sd_v15_v3.safetensors` exists (1.6GB)
- [x] Create `install_videogen_nodes.sh` (AnimateDiff-Evolved + VideoHelperSuite)
- [x] Run node install script, verify folders in `~/.ComfyUI/custom_nodes/`

## Phase 1 — Backend: Workflow + Config
- [x] Add `ANIMATEDIFF_MODEL`, `ANIMATEDIFF_COMPAT_MODELS` to `config.js`
- [x] Create `workflows/animatediff.json` (VHS VideoCombine → GIF output)
- [x] Add `buildAnimateDiffWorkflow()` to `workflows.js`

## Phase 2 — Engine Module
- [x] Create `js/video_engine.js` (`startVideoGen`, `cancelVideoGen`, AbortController)
- [x] Add `setVideoStatus()`, `showVideoProgress()` to `ui.js`

## Phase 3 — HTML UI
- [x] Add Tab 3 button + content pane to `index.html`
- [x] Add 3rd button to mobile bottom nav
- [x] Wire all Tab 3 event listeners in `app.js` `initEventListeners()`
- [x] Update `syncBottomNav()` for videogen tab

## Phase 4 — Verify & Merge
- [x] Commit all changes on `dev/tab3_videogen_01032026`
- [x] Fast-forward merge to `main`, push, delete dev branch