import {
    activeSpriteSize, setActiveSpriteSize,
    MODEL_SPECS, selectedModel, activeStyleKw,
    genSize, setGenSize,
    TRAFFIC_COP_LIVE, COMFY_API_LIVE, CLIENT_ID,
    baseRefBlob, setBaseRefBlob,
    baseRefUploadName, setBaseRefUploadName,
    ANIMATION_PRESETS,
    canvasCtx, setCanvasCtx,
    currentAnimationGrid, setCurrentAnimationGrid,
    setActivePromptIds
} from './config.js';
import { pollHistory, uploadImageToComfy } from './api.js';
import { setSpriteStatus, showSpriteProgress, setProgress, setTabActivity } from './ui.js';
import { buildWorkflow, buildImg2ImgWorkflow } from './workflows.js';
import { saveSession, loadSession, clearSession } from './session.js';
import { playAnimationLoop, retryAnimationRow, cancelRetryAnimation } from './canvas.js';

// ============================================================
//  SPRITE SHEET STAGE 1: REFERENCE GENERATION
// ============================================================

export function setSpriteSize(size, btn) {
    setActiveSpriteSize(size);
    const btns = btn.parentElement.querySelectorAll('.preset-btn');
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

export async function generateSpriteRef() {
    const userPrompt = document.getElementById('spritePrompt').value.trim();
    if (!userPrompt) {
        setSpriteStatus('Please describe your character first.', 'error');
        document.getElementById('spriteStatusBar').style.display = 'flex';
        return;
    }

    const minW = MODEL_SPECS[selectedModel.type]?.minW || 512;
    setGenSize(Math.max(activeSpriteSize, minW));

    let posKw = activeStyleKw.positive || 'pixel art, 16-bit, retro game sprite, isolated on solid white background, full body';
    let negKw = activeStyleKw.negative || 'photorealistic, blurry, noise, 3d, realistic, background details';

    const positivePrompt = `${userPrompt}, ${posKw}`;
    const negativePrompt = negKw;

    const btn = document.getElementById('btnGenRef');
    btn.disabled = true;
    btn.textContent = '⏳ Generating Reference…';

    document.getElementById('spriteRefImg').style.display = 'none';
    document.getElementById('spriteEmpty').style.display = 'none';
    document.getElementById('spriteLoaderWrap').classList.add('visible');
    document.getElementById('btnApproveRef').disabled = true;

    setSpriteStatus('🚦 Initializing hardware…', 'active');
    showSpriteProgress(true);
    setProgress(0, 'sprite');

    try {
        const spriteModel = getSpriteModel();
        let steps = 4;
        let cfg = 2.0;

        if (spriteModel.type === 'sd15' || spriteModel.type === 'sdxl') {
            steps = 20;
            cfg = 7.0;
        } else if (spriteModel.type === 'sdxl_lightning') {
            steps = 4;
            cfg = 2.0;
        }

        const workflowData = await buildWorkflow(
            positivePrompt,
            negativePrompt,
            {
                name: selectedModel.name,
                type: selectedModel.type,
                width: genSize,
                height: genSize,
                seed: Math.floor(Math.random() * 9999999999),
                steps: steps,
                cfg: cfg
            }
        );

        setSpriteStatus('🚦 Waking up ComfyUI…', 'active');
        document.getElementById('btnGenRef').textContent = '🚦 Waking up ComfyUI…';
        const copRes = await fetch(`${TRAFFIC_COP_LIVE}/comfyui/start`, { method: 'POST' });
        const copData = await copRes.json();
        if (copData.status !== 'success') {
            throw new Error(`Traffic Cop failed: ${copData.message || 'Could not start ComfyUI'}`);
        }

        setSpriteStatus('⏳ Generating Reference Frame…', 'active');
        document.getElementById('btnGenRef').textContent = '⏳ Generating Reference…';
        const res = await fetch(`http://${COMFY_API_LIVE}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflowData, client_id: CLIENT_ID })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`ComfyUI Error (${res.status}): ${errText}`);
        }
        const data = await res.json();
        setActivePromptIds({ sprite: data.prompt_id });

        const fileData = await pollHistory(data.prompt_id);

        const subfolderQuery = fileData.subfolder ? `&subfolder=${encodeURIComponent(fileData.subfolder)}` : '';
        const imgUrl = `http://${COMFY_API_LIVE}/view?filename=${encodeURIComponent(fileData.filename)}${subfolderQuery}&type=output&t=${Date.now()}`;
        document.getElementById('spriteRefImg').src = imgUrl;
        document.getElementById('spriteRefImg').style.display = 'block';

        const imgRes = await fetch(imgUrl);
        const blobResult = await imgRes.blob();
        setBaseRefBlob(blobResult);

        document.getElementById('btnApproveRef').disabled = false;

        setSpriteStatus('✅ Reference character generated successfully!', 'success');

    } catch (err) {
        setSpriteStatus(err.message, 'error');
        document.getElementById('spriteEmpty').style.display = 'block';
    } finally {
        document.getElementById('spriteLoaderWrap').classList.remove('visible');
        showSpriteProgress(false);
        btn.textContent = '✦ Generate Reference Frame';
        setActivePromptIds({ sprite: null });
    }
}

// ============================================================
//  SPRITE SHEET STAGE 2: CONFIGURATION
// ============================================================

export async function handleCustomUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    setSpriteStatus('Loading custom reference...', 'active');
    showSpriteProgress(true);
    setProgress(50);

    try {
        const maxSide = Math.max(activeSpriteSize * 4, 1024);
        const resizedBlob = await resizeImageBlob(file, maxSide);
        setBaseRefBlob(resizedBlob);
        const imgUrl = URL.createObjectURL(resizedBlob);

        const prevSrc = document.getElementById('spriteRefImg').src;
        if (prevSrc.startsWith('blob:')) URL.revokeObjectURL(prevSrc);

        // Ensure to revoke eventually if we replace again
        document.getElementById('spriteRefImg').src = imgUrl;
        document.getElementById('spriteLoaderWrap').classList.remove('visible');
        document.getElementById('spriteRefImg').src = imgUrl;
        document.getElementById('spriteRefImg').style.display = 'block';

        document.getElementById('btnApproveRef').disabled = false;

        setSpriteStatus(`Custom reference loaded (resized to ${maxSide}px max)!`, 'success');
        showSpriteProgress(false);

    } catch (err) {
        console.error(err);
        setSpriteStatus('Failed to load custom image', 'error');
        showSpriteProgress(false);
    }
}

function resizeImageBlob(blob, maxSide) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const ctx = c.getContext('2d');
            ctx.imageSmoothingEnabled = false; // Nearest-neighbor for pixel art
            ctx.drawImage(img, 0, 0, w, h);
            c.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/png');
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
        img.src = url;
    });
}

// Sync initial sprite model with the active chip in index.html (AnyLoRA/SD1.5)
let selectedSpriteModel = { name: 'AnyLoRA_noVae_fp16-pruned.safetensors', type: 'sd15' };

export function selectSpriteModel(el) {
    document.querySelectorAll('#spriteModelGrid .sprite-model-chip').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    selectedSpriteModel = { name: el.dataset.model, type: el.dataset.type };
}

export function getSpriteModel() {
    return selectedSpriteModel;
}

export function initAnimationPicker() {
    const container = document.getElementById('animationPicker');
    container.innerHTML = '';
    ANIMATION_PRESETS.forEach(anim => {
        const btn = document.createElement('button');
        btn.className = 'preset-btn';
        btn.innerText = anim.name;
        btn.onclick = () => toggleAnimationSelection(anim.id, btn);
        container.appendChild(btn);
    });
}

function getCheckedAnimIds() {
    const activeBtns = document.querySelectorAll('#animationPicker .preset-btn.active');
    return Array.from(activeBtns).map(btn => ANIMATION_PRESETS.find(p => p.name === btn.innerText).id);
}

let selectedAnimations = [];

export function toggleAnimationSelection(animId, btn) {
    btn.classList.toggle('active');
    selectedAnimations = getCheckedAnimIds();

    if (selectedAnimations.includes(animId)) {
    }

    renderPoseOverrides();
    document.getElementById('btnStartAnim').disabled = selectedAnimations.length === 0;
}

export function renderPoseOverrides() {
    const container = document.getElementById('poseOverrideContainer');
    container.innerHTML = '';
    if (selectedAnimations.length === 0) return;

    const helpText = document.createElement('div');
    helpText.style.fontSize = '12px';
    helpText.style.color = 'var(--text-dim)';
    helpText.innerText = 'Advanced: Override the default pose prompt for each sequence.';
    container.appendChild(helpText);

    selectedAnimations.forEach(animId => {
        const preset = ANIMATION_PRESETS.find(p => p.id === animId);
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.alignItems = 'center';

        const lbl = document.createElement('div');
        lbl.innerText = preset.name;
        lbl.style.width = '80px';
        lbl.style.fontSize = '12px';
        lbl.style.fontWeight = 'bold';

        const inp = document.createElement('input');
        inp.type = 'text';
        inp.id = `poseOverride_${animId}`;
        inp.className = 'pixel-input';
        inp.value = preset.pose;
        inp.style.flex = '1';

        row.appendChild(lbl);
        row.appendChild(inp);
        container.appendChild(row);
    });
}

export function approveReference() {
    const imgEl = document.getElementById('spriteRefImg');
    const src = imgEl.src;

    setBaseRefUploadName(null);
    let referenceImageFilename = null;

    if (src.startsWith('blob:')) {
        referenceImageFilename = '__blob__';
    } else {
        const urlParams = new URLSearchParams(src.split('?')[1]);
        referenceImageFilename = urlParams.get('filename');
    }

    if (!referenceImageFilename) return;

    document.getElementById('stage2Config').style.display = 'block';
    document.getElementById('stage2Config').scrollIntoView({ behavior: 'smooth' });
}


// ============================================================
//  SPRITE SHEET STAGE 3: QUEUE ENGINE 
// ============================================================
let cancelGenerationFlag = false;
let _generationAbortController = null;
let _tempUploads = [];

export function buildTimelineRow(animId, preset, framesCount, rowIndex) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'timeline-row';

    const label = document.createElement('div');
    label.className = 'timeline-label';
    label.innerText = preset?.name || animId;
    rowDiv.appendChild(label);

    const framesDiv = document.createElement('div');
    framesDiv.id = `timeline_${animId}`;
    framesDiv.className = 'timeline-frames';
    framesDiv.innerText = '⬜'.repeat(framesCount);
    rowDiv.appendChild(framesDiv);

    const playBtn = document.createElement('button');
    playBtn.className = 'timeline-btn timeline-play';
    playBtn.innerText = '▶️ Play';
    playBtn.style.display = 'none';
    playBtn.onclick = () => playAnimationLoop(animId, rowIndex, framesCount);
    rowDiv.appendChild(playBtn);

    const retryRowBtn = document.createElement('button');
    retryRowBtn.className = 'timeline-btn timeline-retry';
    retryRowBtn.innerText = '♻️';
    retryRowBtn.title = 'Retry entire row';
    retryRowBtn.style.display = 'none';
    retryRowBtn.onclick = () => retryAnimationRow(animId, rowIndex, framesCount);
    rowDiv.appendChild(retryRowBtn);

    return { rowDiv, framesDiv, playBtn, retryRowBtn };
}

export function cancelAnimationQueue() {
    cancelGenerationFlag = true;
    if (_generationAbortController) {
        _generationAbortController.abort();
        _generationAbortController = null;
    }
    cancelRetryAnimation();

    // Also tell ComfyUI backend to halt the GPU process
    try {
        fetch(`http://${COMFY_API_LIVE}/interrupt`, { method: 'POST' }).catch(() => { });
        fetch(`http://${COMFY_API_LIVE}/queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clear: true })
        }).catch(() => { });
    } catch (e) { console.error('Failed to interrupt ComfyUI:', e); }

    setSpriteStatus('⛔ Cancelling…', 'error');
    document.getElementById('btnCancelAnim').disabled = true;
    document.getElementById('btnCancelAnim').textContent = 'Cancelling...';
}

export async function startAnimationQueue() {
    const selectedAnims = getCheckedAnimIds();
    setCurrentAnimationGrid(selectedAnims);
    if (selectedAnims.length === 0) {
        alert("Please select at least one animation format.");
        return;
    }

    _generationAbortController = new AbortController();
    const abortSignal = _generationAbortController.signal;

    setBaseRefUploadName(null);
    cancelGenerationFlag = false;

    const framesCount = parseInt(document.getElementById('frameCountSlider').value) || 8;
    const denoise = parseFloat(document.getElementById('denoiseSlider').value) || 0.35;

    const userPrompt = document.getElementById('spritePrompt').value.trim();
    let posKw = activeStyleKw.positive || 'pixel art, 16-bit, retro game sprite, isolated on solid white background, full body';
    let negKw = activeStyleKw.negative || 'photorealistic, blurry, noise, 3d, realistic, background details';
    const basePositivePrompt = `${userPrompt}, ${posKw}`;
    const baseNegativePrompt = negKw;

    const btn = document.getElementById('btnStartAnim');
    btn.disabled = true;
    btn.textContent = '⏳ Animation Engine Running…';
    document.getElementById('btnCancelAnim').style.display = 'block';
    document.getElementById('btnCancelAnim').disabled = false;
    document.getElementById('btnCancelAnim').textContent = '⛔ Cancel';

    document.getElementById('stage3Progress').style.display = 'block';
    document.getElementById('stage3Progress').scrollIntoView({ behavior: 'smooth' });

    const timelineContainer = document.getElementById('timelineContainer');
    timelineContainer.innerHTML = '';

    const canvas = document.getElementById('spriteCanvas');
    canvas.width = activeSpriteSize * framesCount;
    canvas.height = activeSpriteSize * selectedAnims.length;
    canvas.style.display = 'block';
    document.getElementById('canvasEmptyMsg').style.display = 'none';
    const newCtx = canvas.getContext('2d');
    setCanvasCtx(newCtx);
    newCtx.imageSmoothingEnabled = false; // Essential for pixel-perfect grids
    newCtx.clearRect(0, 0, canvas.width, canvas.height);

    _tempUploads = [];
    if (!baseRefUploadName) {
        setSpriteStatus('⬆️ Uploading reference frame to ComfyUI...', 'active');
        const src = document.getElementById('spriteRefImg').src;
        try {
            const res = await fetch(src);
            const blob = await res.blob();
            const newBlobName = await uploadImageToComfy(blob, `ref_${Date.now()}.png`);
            setBaseRefUploadName(newBlobName);
            _tempUploads.push(newBlobName);
        } catch (err) {
            setSpriteStatus(`Upload failed: ${err.message}`, 'error');
            btn.disabled = false;
            btn.textContent = '✦ Start Sequential Generation';
            return;
        }

        const activeStyleName = document.querySelector('.style-chip.active')?.dataset?.style || 'none';
        setSpriteStatus(`✅ Reference ready. Style: [${activeStyleName}] — Starting frame generation…`, 'active');
    }

    const poseOverrides = {};
    selectedAnims.forEach(id => {
        const el = document.getElementById(`poseOverride_${id}`);
        if (el) poseOverrides[id] = el.value.trim();
    });
    saveSession({
        selectedAnimations: selectedAnims,
        framesCount,
        denoise,
        spriteSize: activeSpriteSize,
        basePositivePrompt,
        baseNegativePrompt,
        baseRefUploadName,
        poseOverrides,
        completedFrames: Object.fromEntries(selectedAnims.map(id => [id, []])),
        activePromptId: null,
        activeAnimId: selectedAnims[0],
        activeFrameIndex: 0,
        lastFrameRefImg: baseRefUploadName,
        loraName: document.getElementById('loraInput')?.value.trim() || ''
    });
    setActivePromptIds({ sprite: null, isSequential: true }); // Set flag before starting queue

    const rowStatuses = {};
    selectedAnims.forEach((animId, rowIndex) => {
        const preset = ANIMATION_PRESETS.find(a => a.id === animId);

        const { rowDiv, framesDiv, playBtn, retryRowBtn } = buildTimelineRow(animId, preset, framesCount, rowIndex);
        timelineContainer.appendChild(rowDiv);

        const overrideInput = document.getElementById(`poseOverride_${animId}`);
        const activePose = overrideInput ? overrideInput.value.trim() : preset.pose;
        rowStatuses[animId] = { div: framesDiv, playBtn, retryRowBtn, currentFrame: 0, pose: activePose };
    });

    for (let r = 0; r < selectedAnims.length; r++) {
        const animId = selectedAnims[r];
        const status = rowStatuses[animId];
        const preset = ANIMATION_PRESETS.find(p => p.id === animId);

        const getFramePrompt = (frameIndex) => {
            if (preset && preset.keyframes && preset.keyframes.length > 0) {
                return `${basePositivePrompt}, ${preset.keyframes[frameIndex % preset.keyframes.length]}`;
            }
            return `${basePositivePrompt}, ${status.pose}`;
        };

        let currentFrameRefImg = baseRefUploadName;

        for (let c = 0; c < framesCount; c++) {
            let timelineStr;
            if (cancelGenerationFlag) {
                timelineStr = '\u2705'.repeat(c) + '\u274c'.repeat(framesCount - c);
                status.div.innerText = timelineStr;
                break;
            }

            timelineStr = '\u2705'.repeat(c) + '\u23f3' + '\u2b1c'.repeat(framesCount - c - 1);
            status.div.innerText = timelineStr;

            setSpriteStatus(`Animating ${animId} - Frame ${c + 1}/${framesCount}...`, 'active');
            showSpriteProgress(true);
            setProgress(0, 'sprite');

            const animPrompt = getFramePrompt(c, framesCount);

            try {
                let steps = 15;
                let cfg = 7.0;
                if (selectedModel.type === 'sdxl_lightning') { steps = 4; cfg = 2.0; }

                const workflowData = await buildImg2ImgWorkflow(
                    currentFrameRefImg,
                    animPrompt,
                    baseNegativePrompt,
                    {
                        name: selectedModel.name,
                        type: selectedModel.type,
                        steps: steps,
                        cfg: cfg,
                        denoise: denoise
                    }
                );

                const res = await fetch(`http://${COMFY_API_LIVE}/prompt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: workflowData, client_id: CLIENT_ID }),
                    signal: abortSignal
                });
                if (!res.ok) throw new Error(`ComfyUI Error: ${res.statusText}`);
                const data = await res.json();
                setActivePromptIds({ sprite: data.prompt_id });

                saveSession({ activeAnimId: animId, activeFrameIndex: c, activePromptId: data.prompt_id });

                const fileData = await pollHistory(data.prompt_id, abortSignal);
                const subfolderQuery = fileData.subfolder ? `&subfolder=${encodeURIComponent(fileData.subfolder)}` : '';
                const imgUrl = `http://${COMFY_API_LIVE}/view?filename=${encodeURIComponent(fileData.filename)}${subfolderQuery}&type=output&t=${Date.now()}`;

                await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = () => {
                        canvasCtx.imageSmoothingEnabled = false; // Nearest-neighbor upscale
                        canvasCtx.drawImage(img, c * activeSpriteSize, r * activeSpriteSize, activeSpriteSize, activeSpriteSize);
                        resolve();
                    };
                    img.onerror = reject;
                    img.src = imgUrl;
                });

                const newlyGeneratedBlobRes = await fetch(imgUrl);
                let newlyGeneratedBlob = await newlyGeneratedBlobRes.blob();

                // Category 3: SDXL Sizing Fix (Upscale for img2img recursion)
                if (selectedModel.type === 'sdxl' || selectedModel.type === 'sdxl_lightning') {
                    if (activeSpriteSize < 768) {
                        newlyGeneratedBlob = await resizeImageBlob(newlyGeneratedBlob, 768);
                    }
                }

                currentFrameRefImg = await uploadImageToComfy(newlyGeneratedBlob, `recur_${animId}_${c}_${Date.now()}.png`);
                _tempUploads.push(currentFrameRefImg);

                const sessionState = loadSession(false);
                if (sessionState) {
                    const cf = sessionState.completedFrames || {};
                    if (!cf[animId]) cf[animId] = [];
                    cf[animId][c] = fileData;
                    saveSession({
                        completedFrames: cf,
                        activePromptId: null,
                        lastFrameRefImg: currentFrameRefImg
                    });
                }
                setActivePromptIds({ sprite: null, isSequential: false });
                saveSession({ activePromptId: null });
                timelineStr = '✅'.repeat(c + 1) + '⬜'.repeat(framesCount - c - 1);
                status.div.innerText = timelineStr;

            } catch (err) {
                if (err.name === 'AbortError' || cancelGenerationFlag) {
                    break; // cancel requested — exit frame loop cleanly
                }
                console.error(err);
                timelineStr = '✅'.repeat(c) + '❌' + '⬜'.repeat(framesCount - c - 1);
                status.div.innerText = timelineStr;
                setSpriteStatus(`Error on ${animId} frame ${c + 1}: ${err.message} — Continuing...`, 'error');
            }
        }

        status.playBtn.style.display = 'block';
        status.retryRowBtn.style.display = 'block';
    }

    const wasCancelled = cancelGenerationFlag;
    setSpriteStatus(wasCancelled ? '⛔ Generation cancelled.' : '✨ Sprite Sheet sequence complete!', wasCancelled ? 'error' : 'success');
    showSpriteProgress(false);
    btn.disabled = false;
    btn.textContent = '✦ Start Sequential Generation';
    document.getElementById('btnCancelAnim').style.display = 'none';
    cancelGenerationFlag = false;
    setTabActivity('spritegen', false);
    clearSession();
    logTempUploadsOnComplete();
    if (!wasCancelled) {
        document.getElementById('downloadSheetBtn').style.display = 'block';
        document.getElementById('downloadZipBtn').style.display = 'block';
        document.getElementById('exportSessionBtn').style.display = 'block';
        document.getElementById('importSessionLabel').style.display = 'block';
        document.getElementById('btnReorderFrames').style.display = 'block';
    }
}

// ============================================================
//  RESUME ANIMATION QUEUE (Session Recovery)
// ============================================================
export async function resumeAnimationQueue({ s, rowStatuses }) {
    const selectedAnims = s.selectedAnimations || [];
    const framesCount = s.framesCount || 8;
    const denoise = s.denoise || 0.35;
    const basePositivePrompt = s.basePositivePrompt || '';
    const baseNegativePrompt = s.baseNegativePrompt || '';
    const completedFrames = s.completedFrames || {};

    _generationAbortController = new AbortController();
    const abortSignal = _generationAbortController.signal;
    cancelGenerationFlag = false;

    const btn = document.getElementById('btnStartAnim');
    btn.disabled = true;
    btn.textContent = '⏳ Resuming…';
    const cancelBtn = document.getElementById('btnCancelAnim');
    cancelBtn.style.display = 'block';
    cancelBtn.disabled = false;

    setTabActivity('spritegen', true);
    _tempUploads = [];

    for (let r = 0; r < selectedAnims.length; r++) {
        const animId = selectedAnims[r];
        const status = rowStatuses[animId];
        if (!status) continue;

        const preset = ANIMATION_PRESETS.find(p => p.id === animId);
        const doneFrames = completedFrames[animId] || [];
        // Find the index of first missing frame
        let startFrame = framesCount; // default: already complete
        for (let i = 0; i < framesCount; i++) {
            if (!doneFrames[i]) { startFrame = i; break; }
        }
        if (startFrame >= framesCount) continue; // row fully done, skip

        const getFramePrompt = (frameIndex) => {
            if (preset?.keyframes?.length > 0) {
                return `${basePositivePrompt}, ${preset.keyframes[frameIndex % preset.keyframes.length]}`;
            }
            return `${basePositivePrompt}, ${status.pose || preset?.pose || ''}`;
        };

        // The chain reference should start from the last completed frame if available
        let currentFrameRefImg = s.lastFrameRefImg || baseRefUploadName;

        for (let c = startFrame; c < framesCount; c++) {
            if (cancelGenerationFlag || abortSignal.aborted) {
                const tl = '✅'.repeat(c) + '❌'.repeat(framesCount - c);
                status.div.innerText = tl;
                break;
            }

            status.div.innerText = '✅'.repeat(c) + '⏳' + '⬜'.repeat(framesCount - c - 1);
            setSpriteStatus(`Resuming ${animId} — Frame ${c + 1}/${framesCount}…`, 'active');
            showSpriteProgress(true);
            setProgress(0);

            const animPrompt = getFramePrompt(c);
            try {
                let steps = 15; let cfg = 7.0;
                if (selectedModel.type === 'sdxl_lightning') { steps = 4; cfg = 2.0; }

                const workflowData = await buildImg2ImgWorkflow(
                    currentFrameRefImg, animPrompt, baseNegativePrompt,
                    { name: selectedModel.name, type: selectedModel.type, steps, cfg, denoise }
                );

                const res = await fetch(`http://${COMFY_API_LIVE}/prompt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: workflowData, client_id: CLIENT_ID }),
                    signal: abortSignal
                });
                if (!res.ok) throw new Error(`ComfyUI Error: ${res.statusText}`);
                const data = await res.json();

                saveSession({ activeAnimId: animId, activeFrameIndex: c, activePromptId: data.prompt_id });

                const filename = await pollHistory(data.prompt_id, abortSignal);
                const imgUrl = `http://${COMFY_API_LIVE}/view?filename=${filename}&type=output&t=${Date.now()}`;

                await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.onload = () => {
                        canvasCtx.drawImage(img, c * activeSpriteSize, r * activeSpriteSize, activeSpriteSize, activeSpriteSize);
                        resolve();
                    };
                    img.onerror = reject;
                    img.src = imgUrl;
                });

                const blobRes = await fetch(imgUrl);
                const blob = await blobRes.blob();
                currentFrameRefImg = await uploadImageToComfy(blob, `recur_resume_${animId}_${c}_${Date.now()}.png`);
                _tempUploads.push(currentFrameRefImg);

                const sessionState = loadSession(false);
                if (sessionState) {
                    const cf = sessionState.completedFrames || {};
                    if (!cf[animId]) cf[animId] = [];
                    cf[animId][c] = fileData;
                    saveSession({ completedFrames: cf, activePromptId: null, lastFrameRefImg: currentFrameRefImg });
                }

                status.div.innerText = '✅'.repeat(c + 1) + '⬜'.repeat(framesCount - c - 1);

            } catch (err) {
                if (err.name === 'AbortError' || cancelGenerationFlag) break;
                console.error(err);
                status.div.innerText = '✅'.repeat(c) + '❌' + '⬜'.repeat(framesCount - c - 1);
                setSpriteStatus(`Error on ${animId} frame ${c + 1}: ${err.message} — Continuing…`, 'error');
            }
        }

        status.playBtn.style.display = 'block';
        status.retryRowBtn.style.display = 'block';
    }

    const wasCancelled = cancelGenerationFlag;
    setSpriteStatus(wasCancelled ? '⛔ Resume cancelled.' : '✨ Session resumed — sequence complete!', wasCancelled ? 'error' : 'success');
    showSpriteProgress(false);
    btn.disabled = false;
    btn.textContent = '✦ Start Sequential Generation';
    cancelBtn.style.display = 'none';
    cancelGenerationFlag = false;
    setTabActivity('spritegen', false);
    clearSession();
    logTempUploadsOnComplete();
    if (!wasCancelled) {
        document.getElementById('downloadSheetBtn').style.display = 'block';
        document.getElementById('downloadZipBtn').style.display = 'block';
        document.getElementById('exportSessionBtn').style.display = 'block';
        document.getElementById('importSessionLabel').style.display = 'block';
        document.getElementById('btnReorderFrames').style.display = 'block';
    }
}

// ============================================================
//  FRAME REORDER
// ============================================================
let _reorderList = [];
let _reorderAnimId = '';
let _dragSrcIdx = null;

export function showFrameReorder() {
    const session = loadSession(false);
    if (!session?.completedFrames) return;
    const anims = Object.keys(session.completedFrames).filter(id => (session.completedFrames[id] || []).length > 0);
    if (anims.length === 0) return;

    const sel = document.getElementById('reorderAnimSelect');
    sel.innerHTML = anims.map(id => `<option value="${id}">${id}</option>`).join('');
    sel.onchange = () => buildThumbRow(sel.value);

    buildThumbRow(anims[0]);
    document.getElementById('frameReorderStrip').style.display = 'block';
}

function buildThumbRow(animId) {
    _reorderAnimId = animId;
    const session = loadSession(false);
    _reorderList = [...(session?.completedFrames?.[animId] || [])];

    const row = document.getElementById('frameThumbRow');
    row.innerHTML = '';

    _reorderList.forEach((fileItem, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'frame-thumb-wrap';
        wrap.draggable = true;
        wrap.dataset.idx = i;

        let fname = '', subQ = '';
        if (fileItem && typeof fileItem === 'object') {
            fname = fileItem.filename;
            subQ = fileItem.subfolder ? `&subfolder=${encodeURIComponent(fileItem.subfolder)}` : '';
        } else if (typeof fileItem === 'string') {
            fname = fileItem;
        }

        const img = document.createElement('img');
        img.className = 'frame-thumb';
        img.src = fname ? `http://${COMFY_API_LIVE}/view?filename=${encodeURIComponent(fname)}${subQ}&type=output` : '';
        img.alt = `Frame ${i + 1}`;
        img.draggable = false;

        const label = document.createElement('span');
        label.textContent = `F${i + 1}`;

        wrap.appendChild(img);
        wrap.appendChild(label);

        wrap.addEventListener('dragstart', e => {
            _dragSrcIdx = parseInt(wrap.dataset.idx);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => wrap.style.opacity = '0.35', 0);
        });
        wrap.addEventListener('dragend', () => { wrap.style.opacity = ''; });
        wrap.addEventListener('dragover', e => { e.preventDefault(); wrap.querySelector('img').classList.add('drag-over'); });
        wrap.addEventListener('dragleave', () => wrap.querySelector('img').classList.remove('drag-over'));
        wrap.addEventListener('drop', e => {
            e.preventDefault();
            wrap.querySelector('img').classList.remove('drag-over');
            const targetIdx = parseInt(wrap.dataset.idx);
            if (_dragSrcIdx === null || _dragSrcIdx === targetIdx) return;
            const [moved] = _reorderList.splice(_dragSrcIdx, 1);
            _reorderList.splice(targetIdx, 0, moved);
            _dragSrcIdx = null;
            buildThumbRow(_reorderAnimId);
        });

        row.appendChild(wrap);
    });
}

export function applyFrameReorder() {
    const session = loadSession(false);
    if (!session) return;
    session.completedFrames[_reorderAnimId] = _reorderList;
    saveSession(session);

    const canvas = document.getElementById('spriteCanvas');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const framesCount = _reorderList.length;
    const rowIndex = (session.selectedAnimations || Object.keys(session.completedFrames)).indexOf(_reorderAnimId);
    if (rowIndex < 0) { hideFrameReorder(); return; }

    _reorderList.forEach((filename, col) => {
        if (!filename) return;
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(col * activeSpriteSize, rowIndex * activeSpriteSize, activeSpriteSize, activeSpriteSize);
            ctx.drawImage(img, col * activeSpriteSize, rowIndex * activeSpriteSize, activeSpriteSize, activeSpriteSize);
        };
        img.src = `http://${COMFY_API_LIVE}/view?filename=${filename}&type=output`;
    });

    hideFrameReorder();
    setSpriteStatus(`✅ Frame order applied for ${_reorderAnimId}`, 'success');
}

export function hideFrameReorder() {
    document.getElementById('frameReorderStrip').style.display = 'none';
    document.getElementById('frameThumbRow').innerHTML = '';
    _reorderList = [];
    _reorderAnimId = '';
}

function logTempUploadsOnComplete() {
    if (_tempUploads.length > 0) {
        console.info(
            `[ImageGen] Session complete. ${_tempUploads.length} temp files uploaded to ComfyUI /input:\n` +
            _tempUploads.join('\n') +
            '\nThese can be safely deleted from your ComfyUI input folder.'
        );
    }
}
