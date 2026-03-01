# 🕹 Sprite Sheet Generator — Feature Spec & ToDo

## Overview

A dedicated **Tab 2** inside `ImageGen` for generating game-ready pixel art sprite sheets
fully offline using ComfyUI. The pipeline has three distinct stages:

```
Stage 1 → Character Approval   (txt2img reference frame)
Stage 2 → Animation Generation (img2img, frame by frame, sequential)
Stage 3 → Sheet Assembly       (canvas-based grid)  →  Download
```

---

## UX Flow

### 📌 Tab Layout
Two tabs inside the existing `index.html` page:
| Tab | Name | Description |
|---|---|---|
| 1 | 🎨 Image Gen | Current tool (unchanged) |
| 2 | 🕹 Sprite Sheet | New sprite pipeline |

---

### Stage 1 — Reference Character

The user describes their character in a prompt and generates a single reference frame.
This uses the **txt2img** ComfyUI workflow (SD 1.5 preferred — fastest, smallest, easiest to keep consistent).

**UI Elements:**
- Prompt textarea (character description)
- Negative prompt
- Style chip row locked to "Pixel Art" (FLUX or SD1.5)
- **Size selector** — Smallest sizes first, mandatory for sprites:
  - `16×16` (micro icon)
  - `32×32` (classic RPG)
  - `48×48` (RPG maker)
  - `64×64` (detailed sprite) ← default
  - `128×128` (high detail)
- "Generate Reference" button
- Preview card showing the generated character
- **"Approve & Continue →"** button (locked until a generation is complete)

> The approved reference image is stored in-memory (as the `img2img` conditioning input) and its filename is passed to Stage 2.

---

### Stage 2 — Animation Configurator

After approving the reference, the user arrives at the Animation Setup screen.

**Animation Preset Picker** (select one or multiple):

| Preset | Frames | Description |
|---|---|---|
| Idle | 4 | Subtle breathing/blinking loop |
| Walk | 8 | Standard 8-frame walk cycle |
| Run  | 6 | Faster stride |
| Attack | 6 | Strike animation |
| Jump  | 5 | Arc: crouch → apex → land |
| Hurt  | 3 | Hit flash + recoil |
| Death | 6 | Fall/collapse |
| Cast  | 6 | Magic wind-up and release |
| Custom | 1–16 | User-defined frame count |

**Smoothness / Frame Count slider:**
- Range: 2–16 frames per animation
- Default: uses preset value above
- Higher = smoother but slower to generate

**Denoising Strength:**
- Range: 0.1–0.8 (how much each frame differs from the reference)
- Low (0.1–0.25) = very consistent to reference, subtle change per frame
- High (0.4–0.6) = more creative variation per frame
- Default: `0.35`

**Prompt Modifier row** (per animation pose hint, optional):
- e.g. `"walking pose, left foot forward"` for Walk frame 1
- Auto-filled by animation preset, user can override

"Start Generation" button → locks UI during generation

---

### Stage 3 — Sequential Frame Engine

The engine runs one frame at a time:
- Passes the **approved reference image** as `img2img` input
- Passes the **pose/frame prompt modifier** as the positive prompt
- Tracks progress in a visual timeline at the top
- Renders each completed frame into the canvas grid in real-time

**Progress Timeline UI:**
```
[Idle: ✅✅✅✅] [Walk: ✅⏳⬜⬜⬜⬜⬜⬜] [Run: ⬜⬜⬜⬜⬜⬜]
```

- ✅ = generated
- ⏳ = currently generating
- ⬜ = queued
- ❌ = error (click to retry)

**Active frame spinner** shows in the canvas grid while a frame generates.

---

### Stage 4 — Sheet Preview & Download

Once all frames complete, a canvas-based **sprite sheet assembler** renders all frames in a grid.

**Layout options:**
- Row-per-animation (e.g. Walk = row 1, Idle = row 2)
- Single-row strip
- Custom columns

**Interactivity:**
- Click any cell → opens single-frame preview overlay
- Right-click or "⚠️ Retry" button on any cell → re-generates just that frame
- "Retry entire animation" → re-generates all frames of that row

**Download options:**
- `Download Full Sheet (PNG)` — all frames assembled
- `Download Individual Frames (ZIP)` — one PNG per frame
- `Copy to Clipboard` — last selected frame

---

## ComfyUI Workflow Nodes Required

### Txt2Img (Stage 1) — Already available
Uses: `CheckpointLoaderSimple`, `CLIPTextEncode`, `KSampler`, `VAEDecode`, `SaveImage`

### Img2Img (Stage 2 frames) — New workflow
```
Node: LoadImage          → loads the reference frame PNG from ComfyUI output
Node: VAEEncode          → encodes it into latent space
Node: CLIPTextEncode     → positive prompt with pose modifier
Node: CLIPTextEncode     → negative prompt
Node: KSampler           → denoise: 0.35 (adjustable), steps: 15
Node: VAEDecode
Node: SaveImage
```

### Background Removal (Optional pre-sheet step)
- Calls `rembg` CLI after each frame
- Makes frames transparent for clean sprite sheet

---

## Custom Node Dependencies

| Node | Purpose | Repo |
|---|---|---|
| None required | img2img uses built-in ComfyUI nodes | — |
| `Comfy-rembg` (optional) | In-pipeline background removal | github.com/Smirnov75/ComfyUI-mxToolkit |
| `Image Grid` (optional) | In-ComfyUI sheet assembly | github.com/Kosinkadink/ComfyUI-VideoHelperSuite |

> All assembly can be done in the browser with the HTML5 `<canvas>` API — no node required.

---

## Architecture — Code Structure

**Decision: in-page tab switcher** (no separate file, no server changes needed).

```
ImageGen/
└── index.html   ← Both tabs live here (Tab 1: Image Gen, Tab 2: Sprite Sheet)
```

Tab 1 and Tab 2 are separate `<div>` sections toggled by JS. Shared ComfyUI API helpers are extracted into a `<script>` block at the top of `index.html`.

---

## Phased Build Plan

### ✅ Phase 0 (DONE)
- Base ImageGen UI with model selector, style chips, controls

### 📋 Phase 1 — Sprite Tab Shell
- [ ] Add tab switcher UI (Tab 1: Image Gen / Tab 2: Sprite Sheet)
- [ ] Create Stage 1 UI (reference character prompt, size selector 16–128px, generate button)
- [ ] Wire Stage 1 to existing ComfyUI txt2img workflow with pixel art style

### 📋 Phase 2 — Animation Configurator
- [ ] Animation preset picker (Idle, Walk, Run, Attack, Jump, Hurt, Death, Cast)
- [ ] Frame count slider per preset
- [ ] Denoising strength slider
- [ ] "Start Generation" button that builds the frame queue

### 📋 Phase 3 — Sequential Frame Engine
- [ ] Frame queue executor (single frame at a time, sequential, not parallel)
- [ ] img2img ComfyUI workflow builder (passes reference image + pose prompt)
- [ ] Progress timeline UI (✅⏳⬜❌ per frame)
- [ ] Real-time canvas preview update as each frame completes

### 📋 Phase 4 — Sheet Assembly & Download
- [ ] HTML5 Canvas assembler (row-per-animation grid)
- [ ] Per-cell click → single frame preview
- [ ] Per-cell "Retry" → re-runs just that frame
- [ ] "Retry Row" → re-generates entire animation row
- [ ] Download full sheet as PNG
- [ ] Download as ZIP of individual frames (using JSZip — FOSS, no CDN, bundle locally)
- [ ] Optional: `rembg` background removal call per frame

### 📋 Phase 5 — Polish
- [ ] Animation preview (CSS/canvas loop of completed frames at selected FPS)
- [ ] Export as animated GIF (using gif.js — FOSS, bundle locally)
- [ ] Pose prompt editor per frame
- [ ] Import existing PNG as reference instead of generating one
