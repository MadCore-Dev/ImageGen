import {
    MODEL_FILES,
    selectedModel,
    imgWidth,
    imgHeight,
    setLastSeed,
    ANIMATEDIFF_MODEL,
    ANIMATEDIFF_DEFAULTS,
    MODEL_SPECS
} from './config.js';

// ============================================================
//  WORKFLOW BUILDERS (model-aware routing)
// ============================================================
let _workflowCache = {};
export async function loadWorkflowTemplate(name) {
    if (_workflowCache[name]) return JSON.parse(JSON.stringify(_workflowCache[name]));
    try {
        const res = await fetch(`workflows/${name}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        _workflowCache[name] = data;
        return JSON.parse(JSON.stringify(data));
    } catch (err) {
        console.error(`Failed to load workflow template ${name}:`, err);
        throw err;
    }
}

function injectLoras(flow, loraName, modelNodeId, clipNodeId) {
    if (!loraName) return { modelNode: modelNodeId, clipNode: clipNodeId };

    const loras = loraName.split(',').map(n => n.trim()).filter(Boolean);
    if (loras.length === 0) return { modelNode: modelNodeId, clipNode: clipNodeId };

    let currentModelNode = modelNodeId;
    let currentClipNode = clipNodeId;
    let loraIdPrefix = 20;

    loras.forEach(lora => {
        const loraId = loraIdPrefix.toString();
        flow[loraId] = {
            "class_type": "LoraLoader",
            "inputs": {
                "lora_name": lora,
                "strength_model": 1.0,
                "strength_clip": 1.0,
                "model": [currentModelNode, 0],
                "clip": [currentClipNode, currentClipNode === "2" ? 0 : 1]
            }
        };
        currentModelNode = loraId;
        currentClipNode = loraId;
        loraIdPrefix++;
    });

    return { modelNode: currentModelNode, clipNode: currentClipNode };
}

export async function buildWorkflow(positivePrompt, negativePrompt, opts = {}) {
    const type = opts.type || selectedModel.type;
    const model = opts.name || selectedModel.name;
    const seed = opts.seed !== undefined ? opts.seed : (parseInt(document.getElementById('seedInput').value) ||
        Math.floor(Math.random() * 1000000000));
    const steps = opts.steps !== undefined ? opts.steps : parseInt(document.getElementById('stepsSlider').value);
    const cfg = opts.cfg !== undefined ? opts.cfg : parseFloat(document.getElementById('cfgSlider').value);
    const w = opts.width || imgWidth;
    const h = opts.height || imgHeight;
    const loraName = document.getElementById('loraInput')?.value.trim();

    setLastSeed(seed);

    if (type === 'gguf') {
        const flow = await loadWorkflowTemplate('txt2img_flux');
        flow["1"].inputs.unet_name = MODEL_FILES.flux.unet;
        flow["2"].inputs.clip_name1 = MODEL_FILES.flux.clip1;
        flow["2"].inputs.clip_name2 = MODEL_FILES.flux.clip2;
        flow["3"].inputs.vae_name = MODEL_FILES.flux.vae;
        flow["4"].inputs.text = positivePrompt;
        flow["9"].inputs.text = "";
        flow["5"].inputs.width = w;
        flow["5"].inputs.height = h;
        flow["6"].inputs.seed = seed;
        flow["6"].inputs.steps = steps;
        flow["6"].inputs.cfg = cfg;

        const { modelNode, clipNode } = injectLoras(flow, loraName, "1", "2");
        if (modelNode !== "1") {
            flow["6"].inputs.model = [modelNode, 0];
            flow["4"].inputs.clip = [clipNode, 1];
            flow["9"].inputs.clip = [clipNode, 1];
        }
        return flow;
    } else {
        const sampler = type === 'sdxl_lightning' ? 'dpm_2' : 'euler_ancestral';
        const scheduler = type === 'sdxl_lightning' ? 'sgm_uniform' : 'karras';
        const isSD15 = type === 'sd15';

        const flow = await loadWorkflowTemplate('txt2img_sd');
        flow["1"].inputs.ckpt_name = model;
        flow["4"].inputs.text = positivePrompt;
        flow["9"].inputs.text = negativePrompt;
        flow["5"].inputs.width = w;
        flow["5"].inputs.height = h;
        flow["6"].inputs.seed = seed;
        flow["6"].inputs.steps = steps;
        flow["6"].inputs.cfg = cfg;
        flow["6"].inputs.sampler_name = sampler;
        flow["6"].inputs.scheduler = scheduler;

        const { modelNode, clipNode } = injectLoras(flow, loraName, "1", "1");
        if (modelNode !== "1") {
            flow["6"].inputs.model = [modelNode, 0];
            flow["4"].inputs.clip = [clipNode, 1];
            flow["9"].inputs.clip = [clipNode, 1];
        }

        if (isSD15) {
            flow["3"] = { "class_type": "VAELoader", "inputs": { "vae_name": MODEL_FILES.sd15.vae } };
            flow["7"].inputs.vae = ["3", 0];
        }
        return flow;
    }
}

export async function buildImg2ImgWorkflow(refFilename, positivePrompt, negativePrompt, opts = {}) {
    const type = opts.type || selectedModel.type;
    const model = opts.name || selectedModel.name;
    const seed = Math.floor(Math.random() * 9999999999);
    const steps = opts.steps || 15;
    const cfg = opts.cfg || 7.0;
    const denoise = opts.denoise !== undefined ? opts.denoise : parseFloat(document.getElementById('denoiseSlider')?.value || 0.55);
    const loraName = document.getElementById('loraInput')?.value.trim();

    if (type === 'gguf') {
        const flow = await loadWorkflowTemplate('img2img_flux');
        flow["1"].inputs.unet_name = MODEL_FILES.flux.unet;
        flow["2"].inputs.clip_name1 = MODEL_FILES.flux.clip1;
        flow["2"].inputs.clip_name2 = MODEL_FILES.flux.clip2;
        flow["3"].inputs.vae_name = MODEL_FILES.flux.vae;
        flow["4"].inputs.text = positivePrompt;
        flow["9"].inputs.text = "";
        flow["10"].inputs.image = refFilename;
        flow["6"].inputs.seed = seed;
        flow["6"].inputs.steps = steps;
        flow["6"].inputs.cfg = cfg;
        flow["6"].inputs.denoise = denoise;

        const { modelNode, clipNode } = injectLoras(flow, loraName, "1", "2");
        if (modelNode !== "1") {
            flow["6"].inputs.model = [modelNode, 0];
            flow["4"].inputs.clip = [clipNode, 1];
            flow["9"].inputs.clip = [clipNode, 1];
        }
        return flow;
    } else {
        const sampler = type === 'sdxl_lightning' ? 'dpm_2' : 'euler_ancestral';
        const scheduler = type === 'sdxl_lightning' ? 'sgm_uniform' : 'karras';
        const isSD15 = type === 'sd15';

        const flow = await loadWorkflowTemplate('img2img_sd');
        flow["1"].inputs.ckpt_name = model;
        flow["4"].inputs.text = positivePrompt;
        flow["9"].inputs.text = negativePrompt;
        flow["10"].inputs.image = refFilename;
        flow["6"].inputs.seed = seed;
        flow["6"].inputs.steps = steps;
        flow["6"].inputs.cfg = cfg;
        flow["6"].inputs.sampler_name = sampler;
        flow["6"].inputs.scheduler = scheduler;
        flow["6"].inputs.denoise = denoise;

        const { modelNode, clipNode } = injectLoras(flow, loraName, "1", "1");
        if (modelNode !== "1") {
            flow["6"].inputs.model = [modelNode, 0];
            flow["4"].inputs.clip = [clipNode, 1];
            flow["9"].inputs.clip = [clipNode, 1];
        }

        if (isSD15) {
            flow["3"] = { "class_type": "VAELoader", "inputs": { "vae_name": MODEL_FILES.sd15.vae } };
            flow["7"].inputs.vae = ["3", 0];
            flow["11"].inputs.vae = ["3", 0];
        }
        return flow;
    }
}

/**
 * Build an AnimateDiff API payload for Tab 3 — Animate.
 * Loads animatediff.json template and patches all runtime fields.
 * @param {string} positivePrompt
 * @param {string} negativePrompt
 * @param {Object} opts - { modelName, frameCount, fps, width, height, steps, cfg, seed }
 */
export async function buildAnimateDiffWorkflow(positivePrompt, negativePrompt, opts = {}) {
    const modelName = opts.modelName || 'DreamShaper_8_pruned.safetensors';
    const frameCount = opts.frameCount || ANIMATEDIFF_DEFAULTS.frameCount;
    const fps = opts.fps || ANIMATEDIFF_DEFAULTS.fps;
    const width = opts.width || ANIMATEDIFF_DEFAULTS.width;
    const height = opts.height || ANIMATEDIFF_DEFAULTS.height;
    const steps = opts.steps || ANIMATEDIFF_DEFAULTS.steps;
    const cfg = opts.cfg || ANIMATEDIFF_DEFAULTS.cfg;
    const seed = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 9999999999);

    const flow = await loadWorkflowTemplate('animatediff');

    // Node 1 — Checkpoint
    flow['1'].inputs.ckpt_name = modelName;

    // Node 2 — AnimateDiff loader
    flow['2'].inputs.model_name = ANIMATEDIFF_MODEL;

    // Node 3 — VAE (always the SD1.5 vae)
    flow['3'].inputs.vae_name = MODEL_FILES.sd15.vae;

    // Nodes 4 & 5 — prompts
    flow['4'].inputs.text = positivePrompt;
    flow['5'].inputs.text = negativePrompt;

    // Node 6 — latent size + frame count as batch
    flow['6'].inputs.width = width;
    flow['6'].inputs.height = height;
    flow['6'].inputs.batch_size = frameCount;

    // Node 7 — KSampler
    flow['7'].inputs.seed = seed;
    flow['7'].inputs.steps = steps;
    flow['7'].inputs.cfg = cfg;

    // Node 9 — VHS VideoCombine → GIF output
    flow['9'].inputs.frame_rate = fps;

    // Node 10 — Context (frame window for looping)
    flow['10'].inputs.request_n_frames = frameCount;
    flow['10'].inputs.length = Math.min(frameCount, 16); // context window

    const loraName = document.getElementById('loraInput')?.value.trim();
    const { modelNode, clipNode } = injectLoras(flow, loraName, "1", "1");
    if (modelNode !== "1") {
        flow['7'].inputs.model = [modelNode, 0];
        flow['4'].inputs.clip = [clipNode, 1];
        flow['5'].inputs.clip = [clipNode, 1];
    }

    return flow;
}

