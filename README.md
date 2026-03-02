# Project Epoch: Offline Image Gen

Welcome to **Project Epoch**, a hyper-customized, fully offline web application interface designed to generate images, dynamic sprite sheets, and AnimateDiff videos using your local machine’s power. 

Project Epoch acts as an advanced GUI that connects seamlessly to a local [ComfyUI](https://github.com/comfyanonymous/ComfyUI) backend via REST and WebSockets. By separating the frontend interface from the node-based ComfyUI, you get a clean, polished, user-friendly experience tailored for immediate rapid generation.

---

## 🌟 Core Modules

### 1. 🎨 Image Gen (Tab 1)
A beautifully designed workspace for text-to-image workflows. Includes quick style presets (Pixel Art, Fantasy, Cinematic, etc.), automatic model switching, LoRA injection (FLUX), negative prompting, and batch processing.

### 2. 🕹️ Sprite Sheet Generator (Tab 2)
An iterative pipeline designed for game developers. Generate a base character reference, lock it in, and then execute sequential frame-by-frame rendering. The frontend automatically manages Denoising strength step-iteration and stitches the frames together on an HTML5 Canvas into a downloadable sprite sheet or individual ZIP file!

### 3. 🎬 Animate (Tab 3)
A full AnimateDiff integration. Write a motion prompt and generate short AI video loops natively in your browser. This pipeline relies on AnimateDiff-Evolved nodes to generate dynamic MP4/GIF outputs.

---

## 🚀 Quick Start

Ensure you have your ComfyUI backend running (and explicitly whitelisted for CORS) on port `8188`.
(See the Setup Guide for details on how to configure your backend).

Start the frontend application by running the launcher script in your terminal:

```bash
./start_gen.sh
```

This will spin up a lightweight Python HTTP server dynamically on an available port, launch your default browser, and connect directly to ComfyUI.

*(If you ever interrupt a generation, the app features **Universal Session Recovery** via LocalStorage, so you will never lose your session!)*

---

## 📚 Documentation

Dive into the detailed documentation located in the `docs/` folder:

- 📖 **[Setup & Models Guide](docs/setup_guide.md)**: Detailed dependency setups, which model weights to download (FLUX, Juggernaut, PONY, AnimateDiff), and how to configure ComfyUI to accept frontend requests.
- 📐 **[Architecture Overview](docs/architecture.md)**: Explore how the Vanilla Javascript state management, dynamic workflow builders (`workflows.js`), and WebSocket API polling (`api.js`) keep the app fast and reactive without heavy frameworks.
- ✨ **[Features & Usage](docs/features.md)**: Deeper look into parameters, CFG scales, Sprite Sheet generation techniques, and tips for creating flawless results.
- ⚙️ **[Developer Guide](docs/developer_guide.md)**: Learn how to inject your own new custom models, edit styles, and modify ComfyUI JSON graph layouts dynamically.

---

### License
This is a personal project interface extending the capabilities of ComfyUI. Models, checkpoints, and generated output properties belong to their respective creators and licenses.
