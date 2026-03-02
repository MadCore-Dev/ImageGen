# Developer Guide

Extending Project Epoch involves editing the core frontend Javascript files securely. Here's a quick guide on customizing the setup.

## 1. Adding New Models
To add a new base checkpoint to the GUI, open `js/config.js` and modify the `MODELS` constant object.

```javascript
export const MODELS = [
    { id: "new_model_name.safetensors", label: "My Custom Model", type: "sdxl" }
];
```

The `type` parameter changes how the node graph is built (e.g., `gguf` types inject the custom GGUF Unet Loader, `sdxl` injects dual text-encoders, while `sd15` uses basic conditioning). 

## 2. Adding New Styles
In `config.js`, the `STYLES` object determines what presets are available in Tab 1.
To create a new one:
```javascript
"cyberpunk": { 
    model: "DreamShaperXL_Lightning.safetensors", 
    prompt: "cyberpunk, neon glow, dystopian city, high contrast, 8k resolution", 
    neg: "daylight, nature, rustic, low quality" 
}
```
You will then need to add the corresponding HTML `<button class="style-chip" data-style="cyberpunk">` to `index.html`.

## 3. Modifying Workflows
The true power of this app resides in `js/workflows.js`.
When the frontend speaks to ComfyUI, it does not send "parameters"—it sends a fully baked JSON structural graph.

If you installed an Upscaler Node (e.g., ESRGAN) or ControlNet to your ComfyUI, you must edit `buildWorkflow()`:
1. Increment the auto-generated Node ID counter mechanism inside the workflow builder.
2. Route the output of the KSampler node into your newly defined custom Node.
3. Route your new custom Node output into the Save Image terminal node.

*Tip: The easiest way to reverse-engineer `workflows.js` is to build your workflow in the visual ComfyUI interface, click **Save (API Format)** to download a JSON file, and then replicate that JSON structure natively inside Javascript.*
