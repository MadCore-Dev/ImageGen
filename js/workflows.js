import {
    MODEL_FILES,
    selectedModel,
    imgWidth,
    imgHeight,
    setLastSeed
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

        // fix #23: inject LoRA loader for GGUF
        if (loraName) {
            flow["20"] = { "class_type": "LoraLoader", "inputs": { "lora_name": loraName, "strength_model": 1.0, "strength_clip": 1.0, "model": ["1", 0], "clip": ["2", 0] } };
            flow["6"].inputs.model = ["20", 0];
            flow["4"].inputs.clip = ["20", 1];
            flow["9"].inputs.clip = ["20", 1];
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

        if (loraName) {
            flow["20"] = { "class_type": "LoraLoader", "inputs": { "lora_name": loraName, "strength_model": 1.0, "strength_clip": 1.0, "model": ["1", 0], "clip": ["2", 0] } };
            flow["6"].inputs.model = ["20", 0];
            flow["4"].inputs.clip = ["20", 1];
            flow["9"].inputs.clip = ["20", 1];
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

        if (isSD15) {
            flow["3"] = { "class_type": "VAELoader", "inputs": { "vae_name": MODEL_FILES.sd15.vae } };
            flow["7"].inputs.vae = ["3", 0];
            flow["11"].inputs.vae = ["3", 0];
        }
        return flow;
    }
}
