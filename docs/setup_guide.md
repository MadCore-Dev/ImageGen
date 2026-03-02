# Setup & Models Guide

Because this application relies on a robust node-backend (ComfyUI) to execute the AI inference models, some initial setup is required.

## 1. Prerequisites
- **Python 3.10+** (Required for the `start_gen.sh` helper HTTP server).
- **ComfyUI**: You must have a working, up-to-date [ComfyUI](https://github.com/comfyanonymous/ComfyUI) installed.

### CORS Configuration
ComfyUI by default restricts CORS. In order for the frontend to communicate with it, you must start ComfyUI with the wildcard flag:
```bash
python main.py --enable-cors-header="*"
```

## 2. Required Models (Checkpoints)

This frontend explicitly maps to the following weights. Make sure these exist in your `ComfyUI/models/checkpoints/` folder:

* **FLUX.1 Schnell** (`flux1-schnell.gguf` or equivalent). Note: For GGUF versions, ensure `ComfyUI-GGUF` custom nodes are installed.
* **Juggernaut XL v9** (`Juggernaut-XL_v9.safetensors`) - Standard SDXL.
* **Pony Diffusion V6 XL** (`ponyDiffusionV6XL.safetensors`) - SDXL anime/NSFW/2.5D.
* **DreamShaper 8** (`DreamShaper_8_pruned.safetensors`) - Core SD 1.5 workhorse.
* **AnyLoRA** (`AnyLoRA_noVae_fp16-pruned.safetensors`) - Needed for Pixel Art and sprite generations.
* **epiCRealism** (`epiCRealism_naturalSinRC1.safetensors`) - Included for video testing.

## 3. Required Models (AnimateDiff)

For Tab 3 to function, you need the **AnimateDiff-Evolved** custom node installed in your ComfyUI directory, as well as the **VideoHelperSuite** node for MP4/GIF outputs.
You also need the motion module.
* Insert `mm_sd_v15_v3.safetensors` into your `ComfyUI/custom_nodes/ComfyUI-AnimateDiff-Evolved/models/` folder.

## 4. UI Settings Configurations

When you click the `⚙️ Settings` button in the app header, you can override:
* **ComfyUI API Address**: E.g., `127.0.0.1:8188`. 
* **Traffic Cop Address**: Unused natively standard, but can be configured if routing behind an API gateway.
* **ComfyUI Output Folder**: This defines the explicit PATH to where your images save natively, so the JS app knows where to extract ZIPs or direct absolute paths if necessary.
