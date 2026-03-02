# Features & Usage

Project Epoch is split into three main UI Tabs, each serving a totally different pipeline.

## 🎨 Tab 1: Image Gen
The foundational text-to-image pipeline.

* **Style Chips**: Clickable presets that automatically wrap your base prompt in complex positive/negative keywords for specific art styles. They also automatically select the best model weight for that style (e.g., *Anime* auto-selects Pony Diffusion V6 XL; *Pixel Art* auto-selects FLUX with a LoRA).
* **LoRA Injection**: You can explicitly pass `.safetensors` files from your FLUX LoRA directory into the advanced settings panel to combine them with standard generation.
* **Batching**: Allows firing off up to 4 images consecutively. Results appear in a dynamically resizing grid.

## 🕹️ Tab 2: Sprite Sheet Builder
A unique mode tailored purely for game assets.

1. **Stage 1**: Generate (or upload) a **Reference Character** on a locked grid (e.g., 64x64). 
2. **Stage 2**: Choose a sequence (e.g., "Idle", "Walk", "Attack"). The backend iterates through multiple sub-prompts.
3. **Denoising Interpolation**: Each generated frame acts as the Image-To-Image (`img2img`) base for the *next* frame using a low denoising scale (0.55 recommended). This guarantees character consistency throughout the motion.
4. **HTML5 Canvas Assembly**: The frontend receives individual websocket payloads, strips backgrounds, and paints them consecutively onto a transparent HTML5 canvas strip.

## 🎬 Tab 3: Animate (AnimateDiff)
A dedicated interface for short, looped video output.

* **Frames / FPS**: Modifies the output video block runtime. Higher FPS = smoother video. More Frames = longer render times. 
* **Backend Interrupts**: Because video generation heavily impacts VRAM, hitting "Cancel" natively triggers ComfyUI's `/interrupt` and `/queue` bypasses to flush the GPU memory immediately.
