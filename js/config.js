// ============================================================
//  CONSTANTS & STATE
// ============================================================
export const TRAFFIC_COP = "http://127.0.0.1:5050";
export const COMFY_API = "127.0.0.1:8188";

// ============================================================
//  MODEL FILE NAMES — edit here once, reflects everywhere
// ============================================================
export const MODEL_FILES = {
  flux: {
    unet: 'flux1-schnell-Q4_K_S.gguf',
    clip1: 't5xxl_fp8_e4m3fn.safetensors',
    clip2: 'clip_l.safetensors',
    vae: 'flux_vae.safetensors'
  },
  sd15: {
    vae: 'vae-ft-mse-840000-ema-pruned.safetensors'
  }
};

// ============================================================
//  MODEL CAPABILITY TABLE
// ============================================================
export const MODEL_SPECS = {
  gguf: {
    minW: 256, minH: 256,
    minLabel: 'Min: 256×256',
    presets: [
      { w: 512, h: 512, label: '512×512 ✦ Optimal' },
      { w: 768, h: 512, label: '768×512 (Land)' },
      { w: 512, h: 768, label: '512×768 (Port)' }
    ],
    defaultW: 512, defaultH: 512
  },
  sdxl: {
    minW: 768, minH: 768,
    minLabel: 'Min: 768×768',
    presets: [
      { w: 1024, h: 1024, label: '1024×1024 ✦ Optimal' },
      { w: 1152, h: 768, label: '1152×768 (Land)' },
      { w: 768, h: 1152, label: '768×1152 (Port)' },
      { w: 1216, h: 832, label: '1216×832 (Cinema)' },
      { w: 768, h: 768, label: '768×768 (Min)' }
    ],
    defaultW: 1024, defaultH: 1024
  },
  sdxl_lightning: {
    minW: 768, minH: 768,
    minLabel: 'Min: 768×768',
    presets: [
      { w: 1024, h: 1024, label: '1024×1024 ✦ Optimal' },
      { w: 1152, h: 768, label: '1152×768 (Land)' },
      { w: 768, h: 1152, label: '768×1152 (Port)' },
      { w: 768, h: 768, label: '768×768 (Min)' }
    ],
    defaultW: 1024, defaultH: 1024
  },
  sd15: {
    minW: 256, minH: 256,
    minLabel: 'Min: 256×256',
    presets: [
      { w: 512, h: 512, label: '512×512 ✦ Optimal' },
      { w: 768, h: 512, label: '768×512 (Land)' },
      { w: 512, h: 768, label: '512×768 (Port)' },
      { w: 704, h: 512, label: '704×512 (Wide)' }
    ],
    defaultW: 512, defaultH: 512
  }
};

// ============================================================
//  ART STYLES
// ============================================================
export const STYLE_MAP = {
  photorealistic: {
    modelName: 'Juggernaut-XL_v9.safetensors',
    modelType: 'sdxl',
    positiveKw: 'photorealistic, 8k resolution, highly detailed, sharp focus, cinematic lighting, masterpiece',
    negativeKw: 'anime, cartoon, graphic, text, painting, crayon, graphite, abstract, glitch, deformed, mutated, ugly, disfigured',
    chip: null
  },
  portrait: {
    modelName: 'Juggernaut-XL_v9.safetensors',
    modelType: 'sdxl',
    positiveKw: 'professional portrait photography, bokeh, 85mm lens, dramatic lighting, sharp eyes, highly detailed face',
    negativeKw: 'anime, cartoon, graphic, 3d, deformed eyes, bad anatomy, bad hands, missing fingers',
    chip: null
  },
  anime: {
    modelName: 'ponyDiffusionV6XL.safetensors',
    modelType: 'sdxl',
    positiveKw: 'score_9, score_8_up, score_7_up, source_anime, masterpiece, best quality, highly detailed',
    negativeKw: 'score_1, score_2, score_3, score_4, score_5, score_6, realistic, 3d, photorealistic, bad anatomy',
    chip: null
  },
  pixel: {
    modelName: 'flux',
    modelType: 'gguf',
    positiveKw: 'pixel art, 16-bit, retro game style, clean pixel art, vibrant colors, isolated on solid background',
    negativeKw: 'photorealistic, anime, 3d render, blurry, smooth edges, noise',
    chip: null
  },
  cartoon: {
    modelName: 'DreamShaper_8_pruned.safetensors',
    modelType: 'sd15',
    positiveKw: '2d animation style, cartoon, flat colors, bold outlines, vector art style, cell shaded',
    negativeKw: 'photorealistic, 3d, realistic, highly detailed, noisy, messy lines',
    chip: null
  },
  fantasy: {
    modelName: 'AnyLoRA_noVae_fp16-pruned.safetensors',
    modelType: 'sd15',
    positiveKw: 'fantasy art, epic composition, detailed armor, magical atmosphere, intricate, D&D',
    negativeKw: 'modern, sci-fi, photorealistic, low quality',
    chip: null
  },
  scifi: {
    modelName: 'DreamShaperXL_Lightning.safetensors',
    modelType: 'sdxl_lightning',
    positiveKw: 'cyberpunk, neon lights, futuristic city, sci-fi, octane render, cinematic',
    negativeKw: 'fantasy, medieval, low quality, blurry',
    chip: null
  },
  '3d': {
    modelName: 'DreamShaperXL_Lightning.safetensors',
    modelType: 'sdxl_lightning',
    positiveKw: '3D render, CGI, octane render, volumetric lighting, blender, hyperdetailed, studio render',
    negativeKw: 'cartoon, anime, painting, sketch, 2D',
    chip: null
  },
  nsfw: {
    modelName: 'ponyDiffusionV6XL.safetensors',
    modelType: 'sdxl',
    positiveKw: 'score_9, score_8_up, score_7_up, uncensored, explicit',
    negativeKw: 'score_1, score_2, score_3, low quality, blurry',
    chip: null
  }
};

// ============================================================
//  ANIMATION TYPES (For stage 2)
//  Extracted so we can safely iterate and bind.
// ============================================================
export const ANIMATION_PRESETS = [
  { id: 'Idle', pose: 'standing relaxed, breathing slightly, hands at sides, subtle natural movement' },
  { id: 'Walk', pose: 'walking sequence, legs moving, arms swinging, forward momentum' },
  { id: 'Run', pose: 'running quickly, leaning forward, legs extended, fast pace, dynamic motion' },
  { id: 'Jump', keyframes: ['crouching low, preparing to jump', 'springing upwards, leaping, feet off ground', 'falling downwards, arms raised', 'landing in crouch impact'] },
  { id: 'Attack (Melee)', pose: 'swinging weapon, striking pose, dynamic action, aggressive stance' },
  { id: 'Attack (Ranged)', pose: 'aiming weapon, shooting, drawing bow string, focused pose' },
  { id: 'Hurt', keyframes: ['flinching away, taking damage, pained expression', 'stumbling backwards, recoiling'] },
  { id: 'Death', keyframes: ['falling backwards, collapsing', 'lying flat on the ground, defeated, motionless'] }
];

// Global State Variables used across modules
export let COMFY_API_LIVE = localStorage.getItem('setting_comfy_api') || COMFY_API;
export let TRAFFIC_COP_LIVE = localStorage.getItem('setting_traffic_cop') || TRAFFIC_COP;
export let OUTPUT_PATH_LIVE = localStorage.getItem('setting_output_path') || '/Users/manojsamal/.ComfyUI/output';

export const CLIENT_ID = Math.random().toString(36).substring(2, 10);
export let socket = null;
export let wsRetries = 0;
export const WS_MAX_RETRIES = 5;

export let baseRefBlob = null;
export let baseRefUploadName = null;
export let activeRefImgName = null;

export let genSize = 64;
export let activeSpriteSize = 64;
export let currentAnimationGrid = [];
export let activeCell = { animId: null, frameIndex: null, row: null, col: null };

export let lastSeed = null;
export let lastFilename = null;

export let selectedModel = { name: 'flux', type: 'gguf' };
export let imgWidth = 512;
export let imgHeight = 512;
export let activeStyleKw = { positive: '', negative: '' };

export let canvasCtx = null;

// AbortControllers for cancellation
window._currentFetchAbort = null;

export function setComfyApiLive(val) { COMFY_API_LIVE = val; }
export function setTrafficCopLive(val) { TRAFFIC_COP_LIVE = val; }
export function setOutputPathLive(val) { OUTPUT_PATH_LIVE = val; }

export function setSocket(val) { socket = val; }
export function setWsRetries(val) { wsRetries = val; }

export function setBaseRefBlob(val) { baseRefBlob = val; }
export function setBaseRefUploadName(val) { baseRefUploadName = val; }
export function setActiveRefImgName(val) { activeRefImgName = val; }

export function setGenSize(val) { genSize = val; }
export function setActiveSpriteSize(val) { activeSpriteSize = val; }
export function setCurrentAnimationGrid(val) { currentAnimationGrid = val; }
export function setActiveCell(val) { activeCell = val; }

export function setLastSeed(val) { lastSeed = val; }
export function setLastFilename(val) { lastFilename = val; }
export function setSelectedModel(val) { selectedModel = val; }

export function setImgWidth(val) { imgWidth = val; }
export function setImgHeight(val) { imgHeight = val; }
export function setActiveStyleKw(val) { activeStyleKw = val; }

export function setCanvasCtx(val) { canvasCtx = val; }
