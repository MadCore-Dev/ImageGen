import {
    currentAnimationGrid,
    activeSpriteSize,
    activeCell, setActiveCell,
    ANIMATION_PRESETS,
    canvasCtx,
    baseRefUploadName,
    activeStyleKw,
    COMFY_API_LIVE,
    CLIENT_ID,
    baseRefBlob
} from './config.js';
import { uploadImageToComfy, pollHistory } from './api.js';
import { buildImg2ImgWorkflow } from './workflows.js';
import { setSpriteStatus, showSpriteProgress, setProgress } from './ui.js';
import { getSpriteModel } from './sprite_engine.js';

// ============================================================
//  STAGE 4: SHEET EXPORT & SINGLE FRAME LOGIC
// ============================================================
export function downloadSpriteSheet() {
    const canvas = document.getElementById('spriteCanvas');
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;

    const promptSlug = (document.getElementById('spritePrompt')?.value || 'sprite')
        .trim().slice(0, 24).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const animSlug = (currentAnimationGrid || []).join('-').slice(0, 30) || 'sheet';
    a.download = `epoch_${promptSlug}_${animSlug}_${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export async function downloadFramesZip() {
    const canvas = document.getElementById('spriteCanvas');
    if (!currentAnimationGrid || currentAnimationGrid.length === 0) return;
    const framesCount = parseInt(document.getElementById('frameCountSlider').value, 10) || 8;

    const zip = new JSZip();

    for (let r = 0; r < currentAnimationGrid.length; r++) {
        const animId = currentAnimationGrid[r];
        for (let c = 0; c < framesCount; c++) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = activeSpriteSize;
            tempCanvas.height = activeSpriteSize;
            const tCtx = tempCanvas.getContext('2d');
            tCtx.drawImage(canvas, c * activeSpriteSize, r * activeSpriteSize, activeSpriteSize, activeSpriteSize, 0, 0, activeSpriteSize, activeSpriteSize);

            const dataUrl = tempCanvas.toDataURL('image/png');
            const base64Data = dataUrl.split(',')[1];
            zip.file(`${animId}_frame_${c + 1}.png`, base64Data, { base64: true });
        }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);

    const promptSlug = (document.getElementById('spritePrompt')?.value || 'sprite')
        .trim().slice(0, 24).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const animSlug = (currentAnimationGrid || []).join('-').slice(0, 30) || 'frames';
    a.download = `epoch_${promptSlug}_${animSlug}_${Date.now()}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// Canvas click detection setup (extracted into an exportable init function)
export function initCanvasEventListeners() {
    document.getElementById('spriteCanvas')?.addEventListener('click', (e) => {
        if (!currentAnimationGrid || currentAnimationGrid.length === 0) return;

        const rect = e.target.getBoundingClientRect();
        const scaleX = e.target.width / rect.width;
        const scaleY = e.target.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const col = Math.floor(x / activeSpriteSize);
        const row = Math.floor(y / activeSpriteSize);

        if (row >= currentAnimationGrid.length) return;

        const framesCount = parseInt(document.getElementById('frameCountSlider').value, 10) || 8;
        if (col >= framesCount) return;

        const animId = currentAnimationGrid[row];
        setActiveCell({ animId, frameIndex: col, row, col });

        const previewCanvas = document.getElementById('cellPreviewCanvas');
        previewCanvas.width = activeSpriteSize;
        previewCanvas.height = activeSpriteSize;
        const ctx = previewCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, activeSpriteSize, activeSpriteSize);
        ctx.drawImage(document.getElementById('spriteCanvas'),
            col * activeSpriteSize, row * activeSpriteSize, activeSpriteSize, activeSpriteSize,
            0, 0, activeSpriteSize, activeSpriteSize);

        document.getElementById('previewModalLabel').innerText = `Preview: ${animId} - Frame ${col + 1}`;
        document.getElementById('modalRetryText').style.display = 'block';
        document.getElementById('btnRetryCell').style.display = 'block';
        document.getElementById('btnCopyFrame').style.display = 'block';
        document.getElementById('btnDownloadGif').style.display = 'none';
        document.getElementById('fpsControlRow').style.display = 'none';
        document.getElementById('cellPreviewModal').style.display = 'flex';
    });
}

let animationPreviewInterval = null;
let activeAnimationData = null;

export function playAnimationLoop(animId, row, framesCount) {
    activeAnimationData = { animId, row, framesCount };
    document.getElementById('previewModalLabel').innerText = `Preview: ${animId} (Animation Loop)`;
    document.getElementById('modalRetryText').style.display = 'none';
    document.getElementById('btnRetryCell').style.display = 'none';
    document.getElementById('btnCopyFrame').style.display = 'none';
    document.getElementById('btnDownloadGif').style.display = 'block';
    document.getElementById('fpsControlRow').style.display = 'block';
    document.getElementById('cellPreviewModal').style.display = 'flex';

    const previewCanvas = document.getElementById('cellPreviewCanvas');
    previewCanvas.width = activeSpriteSize;
    previewCanvas.height = activeSpriteSize;
    const ctx = previewCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const sourceCanvas = document.getElementById('spriteCanvas');

    let currentFrame = 0;
    if (animationPreviewInterval) clearInterval(animationPreviewInterval);

    let frameDuration = Math.round(1000 / parseInt(document.getElementById('fpsSlider').value));

    animationPreviewInterval = setInterval(() => {
        ctx.clearRect(0, 0, activeSpriteSize, activeSpriteSize);
        ctx.drawImage(sourceCanvas,
            currentFrame * activeSpriteSize, row * activeSpriteSize, activeSpriteSize, activeSpriteSize,
            0, 0, activeSpriteSize, activeSpriteSize);
        currentFrame = (currentFrame + 1) % framesCount;
    }, frameDuration);
}

export function closeCellPreview() {
    document.getElementById('cellPreviewModal').style.display = 'none';
    if (animationPreviewInterval) {
        clearInterval(animationPreviewInterval);
        animationPreviewInterval = null;
    }
}

export function updatePreviewFps(val) {
    document.getElementById('fpsLabel').innerText = parseFloat(val).toFixed(1);
    if (!activeAnimationData || !animationPreviewInterval) return;
    const { animId, row, framesCount } = activeAnimationData;
    playAnimationLoop(animId, row, framesCount);
}

export async function copyFrameToClipboard() {
    const canvas = document.getElementById('cellPreviewCanvas');
    const btn = document.getElementById('btnCopyFrame');
    try {
        canvas.toBlob(async (blob) => {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            btn.innerText = '✅ Copied!';
            setTimeout(() => { btn.innerText = '📋 Copy Frame to Clipboard'; }, 2000);
        });
    } catch (e) {
        btn.innerText = '❌ Copy Failed';
        setTimeout(() => { btn.innerText = '📋 Copy Frame to Clipboard'; }, 2000);
    }
}

export async function retryAnimationRow(animId, rowIndex, framesCount) {
    const preset = ANIMATION_PRESETS.find(p => p.id === animId);
    if (!preset || !canvasCtx || !baseRefUploadName) return;

    const framesCountCurrent = framesCount;
    const denoise = parseFloat(document.getElementById('denoiseSlider').value) || 0.55;
    const userPrompt = document.getElementById('spritePrompt').value.trim();
    let posKw = activeStyleKw.positive || 'pixel art, 16-bit, retro game sprite, isolated on solid white background, full body';
    const basePositivePrompt = `${userPrompt}, ${posKw}`;
    const baseNegativePrompt = activeStyleKw.negative || 'photorealistic, blurry, noise, 3d, realistic, background details';

    const getFramePrompt = (fi) => preset.keyframes && preset.keyframes.length > 0
        ? `${basePositivePrompt}, ${preset.keyframes[fi % preset.keyframes.length]}`
        : `${basePositivePrompt}, ${preset.pose}`;

    let currentFrameRefImg = baseRefUploadName;

    const timelineDiv = document.getElementById(`timeline_${animId}`);

    for (let c = 0; c < framesCountCurrent; c++) {
        if (timelineDiv) timelineDiv.innerText = '✅'.repeat(c) + '⏳' + '⬜'.repeat(framesCountCurrent - c - 1);
        setSpriteStatus(`Retrying ${animId} - Frame ${c + 1}/${framesCountCurrent}...`, 'active');

        try {
            const retryModel = getSpriteModel();
            let steps = 15, cfg = 7.0;
            if (retryModel.type === 'sdxl_lightning') { steps = 6; cfg = 2.0; }
            else if (retryModel.type === 'gguf') { steps = 4; cfg = 1.0; }
            const denoise = parseFloat(document.getElementById('denoiseSlider')?.value || 0.55);
            const workflowData = await buildImg2ImgWorkflow(
                currentFrameRefImg,
                getFramePrompt(c),
                baseNegativePrompt,
                { name: retryModel.name, type: retryModel.type, steps, cfg, denoise }
            );


            const res = await fetch(`http://${COMFY_API_LIVE}/prompt`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: workflowData, client_id: CLIENT_ID })
            });
            if (!res.ok) throw new Error(`ComfyUI Error: ${res.statusText}`);
            const { prompt_id } = await res.json();
            const filename = await pollHistory(prompt_id);
            const imgUrl = `http://${COMFY_API_LIVE}/view?filename=${filename}&type=output&t=${Date.now()}`;

            await new Promise((resolve, reject) => {
                const img = new Image(); img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    canvasCtx.drawImage(img, c * activeSpriteSize, rowIndex * activeSpriteSize, activeSpriteSize, activeSpriteSize);
                    resolve();
                };
                img.onerror = reject; img.src = imgUrl;
            });

            const blobRes = await fetch(imgUrl);
            const blob = await blobRes.blob();
            currentFrameRefImg = await uploadImageToComfy(blob, `recur_retry_${animId}_${c}.png`);

            if (timelineDiv) timelineDiv.innerText = '✅'.repeat(c + 1) + '⬜'.repeat(framesCountCurrent - c - 1);
        } catch (err) {
            if (timelineDiv) timelineDiv.innerText = '✅'.repeat(c) + '❌' + '⬜'.repeat(framesCountCurrent - c - 1);
            setSpriteStatus(`Retry error on ${animId} frame ${c + 1}: ${err.message}`, 'error');
        }
    }
    setSpriteStatus(`✅ Row ${animId} retried!`, 'success');
}

export function exportActiveAnimationGif() {
    if (!activeAnimationData) return;
    const btn = document.getElementById('btnDownloadGif');
    const ogText = btn.innerText;
    btn.innerText = '⏳ Encoding GIF...';
    btn.disabled = true;

    try {
        const { animId, row, framesCount } = activeAnimationData;
        const sourceCanvas = document.getElementById('spriteCanvas');

        const fpsSliderVal = parseInt(document.getElementById('fpsSlider').value) || 7;
        const gifFrameDelay = Math.round(1000 / fpsSliderVal);
        const gif = new GIF({
            workers: 2,
            quality: 10,
            workerScript: 'gif.worker.js',
            width: activeSpriteSize,
            height: activeSpriteSize,
            transparent: null
        });

        for (let c = 0; c < framesCount; c++) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = activeSpriteSize;
            tempCanvas.height = activeSpriteSize;
            const tCtx = tempCanvas.getContext('2d');
            tCtx.drawImage(sourceCanvas, c * activeSpriteSize, row * activeSpriteSize, activeSpriteSize, activeSpriteSize, 0, 0, activeSpriteSize, activeSpriteSize);

            gif.addFrame(tempCanvas, { delay: gifFrameDelay });
        }

        gif.on('finished', function (blob) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${animId}_animation_${Date.now()}.gif`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 10000);

            btn.innerText = '✅ Exported!';
            setTimeout(() => { btn.innerText = ogText; btn.disabled = false; }, 2000);
        });

        gif.render();
    } catch (err) {
        console.error(err);
        btn.innerText = '❌ Encode Failed';
        setTimeout(() => { btn.innerText = ogText; btn.disabled = false; }, 2000);
    }
}

export async function retryActiveCell() {
    closeCellPreview();
    if (!activeCell.animId) return;
    const { animId, frameIndex, row, col } = activeCell;

    setSpriteStatus(`🔄 Retrying ${animId} Frame ${frameIndex + 1}...`, 'active');
    showSpriteProgress(true);
    setProgress(0);

    try {
        if (!baseRefBlob) throw new Error("Reference image lost. Generate a new reference first.");
        const uploadName = await uploadImageToComfy(baseRefBlob, `sprite_ref_${Date.now()}.png`);

        const preset = ANIMATION_PRESETS.find(p => p.id === animId);
        const userPrompt = document.getElementById('spritePrompt').value.trim();
        let posKw = activeStyleKw.positive || 'pixel art, 16-bit, retro game sprite, isolated on solid white background, full body';
        let negKw = activeStyleKw.negative || 'photorealistic, blurry, noise, 3d, realistic, background details';
        const frameKw = preset?.keyframes?.length > 0
            ? preset.keyframes[frameIndex % preset.keyframes.length]
            : (preset?.pose || '');

        const positivePrompt = `${userPrompt}, ${posKw}, ${frameKw}`;
        const negativePrompt = negKw;

        const spriteModel = getSpriteModel();
        let steps = 15, cfg = 7.0;
        if (spriteModel.type === 'sdxl_lightning') { steps = 6; cfg = 2.0; }
        else if (spriteModel.type === 'gguf') { steps = 4; cfg = 1.0; }
        const denoise = parseFloat(document.getElementById('denoiseSlider')?.value || 0.55);

        const workflowData = await buildImg2ImgWorkflow(
            uploadName,
            positivePrompt,
            negativePrompt,
            { name: spriteModel.name, type: spriteModel.type, steps, cfg, denoise }
        );

        const qRes = await fetch(`http://${COMFY_API_LIVE}/prompt`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflowData, client_id: CLIENT_ID })
        });
        if (!qRes.ok) throw new Error('Failed to queue retry job.');
        const { prompt_id } = await qRes.json();

        const outFilename = await pollHistory(prompt_id);
        const imgUrl = `http://${COMFY_API_LIVE}/view?filename=${outFilename}&type=output`;

        await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.getElementById('spriteCanvas');
                const ctx = canvas.getContext('2d');
                ctx.clearRect(col * activeSpriteSize, row * activeSpriteSize, activeSpriteSize, activeSpriteSize);
                ctx.drawImage(img, 0, 0, activeSpriteSize, activeSpriteSize, col * activeSpriteSize, row * activeSpriteSize, activeSpriteSize, activeSpriteSize);
                resolve();
            };
            img.onerror = reject;
            img.src = imgUrl;
        });

        setSpriteStatus(`✨ Retried ${animId} Frame ${frameIndex + 1} successfully!`, 'success');
        showSpriteProgress(false);

    } catch (err) {
        console.error(err);
        setSpriteStatus(`Error retrying frame: ${err.message}`, 'error');
        showSpriteProgress(false);
    }
}
