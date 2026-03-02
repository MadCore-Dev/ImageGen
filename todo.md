# 🚀 Project Epoch: ImageGen Bug Fix & Audit Status (March 2, 2026)

This document tracks the resolution of the fresh audit performed on the ImageGen project.

## 🚨 CRITICAL BUG FIXES (EXECUTE EXACTLY AS WRITTEN)

**Task 1: Fix AnimateDiff Topology Bug (Fake Video)**
- **File:** `js/workflows.js`
- **Action:** Inside the `buildAnimateDiffWorkflow` function, scroll down to the LoRA injection block at the bottom (around line 214).
- **Change:** Find the line `flow['7'].inputs.model = [modelNode, 0];`. Change the `'7'` to a `'2'`. 
  *It should exactly read:* `flow['2'].inputs.model = [modelNode, 0];`
  *(Note: This correctly routes the LoRA through the AnimateDiff motion module instead of bypassing it).*

**Task 2: Fix Modal Preview Interval Leak**
- **File:** `js/canvas.js`
- **Action:** Inside `initCanvasEventListeners()`, locate the `document.getElementById('spriteCanvas')?.addEventListener('click', (e) => { ... })` block.
- **Change:** Right below `const animId = currentAnimationGrid[row];` add the following exact code to clear any ghost intervals before opening a new cell:
  ```javascript
  if (animationPreviewInterval) {
      clearInterval(animationPreviewInterval);
      animationPreviewInterval = null;
  }

```

**Task 3: Fix Ghost Canvas Click Bounds (Slider Desync)**

* **File:** `js/canvas.js`
* **Action:** Inside `initCanvasEventListeners()`, locate this line inside the canvas click event: `const framesCount = parseInt(document.getElementById('frameCountSlider').value, 10) || 8;`
* **Change:** Replace that single line with these two lines so it reads the true mathematical length of the row from the session:
```javascript
const session = loadSession(false);
const framesCount = session?.completedFrames?.[currentAnimationGrid[row]]?.length || parseInt(document.getElementById('frameCountSlider').value, 10) || 8;

```



**Task 4: Fix Single-Row Retry UI Glitch**

* **File:** `js/canvas.js`
* **Action 1:** Inside `retryAnimationRow()`, immediately after `_cancelRetryFlag = false;`, add this line:
`document.querySelectorAll('.timeline-btn').forEach(b => b.disabled = true);`
* **Action 2:** At the very end of `retryAnimationRow()`, immediately before the closing bracket `}`, add this line:
`document.querySelectorAll('.timeline-btn').forEach(b => b.disabled = false);`

**Task 5: Fix Double-Fetch Network Penalty**

* **File:** `js/sprite_engine.js`
* **Action:** Inside `startAnimationQueue()`, locate the block in the loop starting with `await new Promise((resolve, reject) => { ... img.src = imgUrl; });` and ending with `let newlyGeneratedBlob = await newlyGeneratedBlobRes.blob();` (around lines 338-350).
* **Change:** Replace that entire sequential block with this network-optimized version (fetching the blob *first*, then drawing it):
```javascript
const newlyGeneratedBlobRes = await fetch(imgUrl);
let newlyGeneratedBlob = await newlyGeneratedBlobRes.blob();
const blobUrl = URL.createObjectURL(newlyGeneratedBlob);

await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
        canvasCtx.imageSmoothingEnabled = false;
        canvasCtx.drawImage(img, c * activeSpriteSize, r * activeSpriteSize, activeSpriteSize, activeSpriteSize);
        URL.revokeObjectURL(blobUrl);
        resolve();
    };
    img.onerror = reject;
    img.src = blobUrl;
});

```



**Task 6: Fix Dangling Drag State**

* **File:** `js/sprite_engine.js`
* **Action:** Inside `buildThumbRow()`, find the dragend listener: `wrap.addEventListener('dragend', () => { wrap.style.opacity = ''; });`
* **Change:** Add `_dragSrcIdx = null;` so it exactly reads:
`wrap.addEventListener('dragend', () => { wrap.style.opacity = ''; _dragSrcIdx = null; });`

**Task 7: Fix Loop Runaway on Global API Error**

* **File:** `js/sprite_engine.js`
* **Action:** Inside `startAnimationQueue()`, find the end of the inner frame loop `for (let c = 0; c < framesCount; c++) { ... }`. Immediately *after* that inner loop closes, but *inside* the outer `for (let r = 0...)` loop.
* **Change:** Add this break statement to ensure the outer row loop also stops if an error triggered a global cancel:
```javascript
if (cancelGenerationFlag) break;

```

