# Architecture Overview

Project Epoch is built without heavyweight frontend frameworks (React, Vue, etc.) to keep it blazing fast and easily modifiable. It relies on vanilla JavaScript, HTML5 Canvas, and modern browser APIs.

## 🗂️ File Structure

The `js/` directory houses the core functionality, cleanly separated by component responsibility:

```text
ImageGen/
├── index.html            # Main UI Layout, tabs, and component DOM
├── css/styles.css        # Vanilla CSS, fully responsive, glassmorphism design
├── start_gen.sh          # Bash launcher script (dynamic port allocation)
└── js/                   # Core application scripts
    ├── app.js            # Main entry point, event listeners, Tab 1 Image Gen logic
    ├── api.js            # Fetch and WebSocket handling for ComfyUI backend polling
    ├── workflows.js      # Dynamic workflow JSON generators
    ├── session.js        # Session persistence / Universal Recovery (LocalStorage)
    ├── ui.js             # Utility functions for updating progress bars, toasts, statuses
    ├── config.js         # Centralized configuration, ENUM arrays for Styles/Models
    ├── canvas.js         # Canvas manipulations for Sprite Sheet stitching and preview modal
    ├── sprite_engine.js  # Dedicated engine for Tab 2: Sequential Frame Generation
    └── video_engine.js   # Dedicated engine for Tab 3: AnimateDiff Video Pipeline
```

## 🔄 Core Loops

### 1. Job Orchestration
When a user clicks "Generate", the frontend builds a highly complex ComfyUI workflow (a directed acyclic graph in JSON format) specifically mapped to the active tab's intent (`workflows.js`).
This payload is POSTed to ComfyUI's `/prompt` endpoint (`api.js`), which returns a `prompt_id`.

### 2. Live API Polling & WebSockets
`api.js` acts as the traffic controller. It opens a WebSocket connection to `ws://{COMFY_URL}/ws?clientId={clientId}` and listens to:
* `execution_start`
* `progress` (Max steps vs current step → calculates percentage for progress bars)
* `executed`
* `execution_error`

Once the WebSocket fires an `executed` event, the app fires a `GET` request to `/history/{prompt_id}` to retrieve the output node (the resulting images or GIF) and fetches the generated asset into the DOM.

### 3. Universal Session Recovery
The `session.js` file makes sure you never lose state. Because sprite-sheet generation is multi-step (and potentially takes minutes), dropping connection or refreshing the page could wipe progress.
`session.js` serializes all configurations, canvas node datasets, current uploaded seed references, and timeline progress arrays to `localStorage` upon every significant action and rehydrates everything via `initUniversalSessionRecovery()` on boot.

### 4. Direct GPU Interruptions
To prevent the ComfyUI queue from backing up memory bottlenecks, cancelling a generation (`cancelBtn` listeners in `app.js`, `sprite_engine.js`, `video_engine.js`) instantly triggers two routes:
1. `POST /interrupt` (stops active iteration)
2. `POST /queue { clear: true }` (purges pipeline backlog)

This ensures VRAM is released effectively to the system immediately.
