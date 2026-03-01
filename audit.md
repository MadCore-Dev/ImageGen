# Tab 3 — Animate: Task Board

> Branch: `dev/tab3_videogen_01032026`
> This file replaces the old completed audit items.

## Phase 0 — Prerequisites
- [ ] Add AnimateDiff model dir + motion module to `download_essential_models.sh`
- [ ] Run download script, verify `mm_sd_v15_v3.safetensors` exists
- [ ] Create `install_videogen_nodes.sh` (AnimateDiff-Evolved + VideoHelperSuite)
- [ ] Run node install script, verify folders in `~/.ComfyUI/custom_nodes/`

## Phase 1 — Backend: Workflow + Config
- [ ] Add `ANIMATEDIFF_MODEL`, `ANIMATEDIFF_COMPAT_MODELS` to `config.js`
- [ ] Create `workflows/animatediff.json` (VHS VideoCombine → GIF output)
- [ ] Add `buildAnimateDiffWorkflow()` to `workflows.js`

## Phase 2 — Engine Module
- [ ] Create `js/video_engine.js` (`startVideoGen`, `cancelVideoGen`, AbortController)
- [ ] Add `setVideoStatus()`, `showVideoProgress()` to `ui.js`

## Phase 3 — HTML UI
- [ ] Add Tab 3 button + content pane to `index.html`
- [ ] Add 3rd button to mobile bottom nav
- [ ] Wire all Tab 3 event listeners in `app.js` `initEventListeners()`
- [ ] Update `syncBottomNav()` for videogen tab

## Phase 4 — Verify & Merge
- [ ] Test end-to-end in browser
- [ ] Test cancel flow
- [ ] Test light + dark theme rendering
- [ ] Commit, merge to main, delete branch