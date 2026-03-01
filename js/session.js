import {
    ANIMATION_PRESETS,
    activeSpriteSize, setActiveSpriteSize,
    COMFY_API_LIVE,
    baseRefUploadName, setBaseRefUploadName,
    canvasCtx, setCanvasCtx,
    currentAnimationGrid, setCurrentAnimationGrid
} from './config.js';
import { initWebSocket, pollHistory, uploadImageToComfy } from './api.js';
import { setSpriteStatus, showSpriteProgress } from './app.js';
import { playAnimationLoop, retryAnimationRow } from './canvas.js';

// ============================================================
//  SESSION PERSISTENCE (localStorage-based recovery)
// ============================================================
const SESSION_KEY = 'epoch_sprite_session';
const SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

export function saveSession(updates) {
    try {
        const existing = loadSession(false) || { version: 1, timestamp: Date.now(), completedFrames: {} };
        const merged = Object.assign(existing, updates, { timestamp: Date.now() });
        localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
    } catch (e) { console.warn('Session save failed:', e); }
}

export function loadSession(checkAge = true) {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (checkAge && Date.now() - s.timestamp > SESSION_MAX_AGE_MS) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return s;
    } catch (e) { return null; }
}

export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

export function dismissSession() {
    clearSession();
    document.getElementById('recoveryBanner').style.display = 'none';
}

export function checkForRecovery() {
    const s = loadSession();
    if (!s) return;

    const lines = (s.selectedAnimations || []).map(id => {
        const frames = s.completedFrames?.[id] || [];
        const done = frames.filter(Boolean).length;
        return `${id} (${done}/${s.framesCount || '?'} frames)`;
    });
    const activePart = s.activePromptId
        ? ` \u2014 Frame ${(s.activeFrameIndex ?? 0) + 1} of ${s.activeAnimId} still rendering...`
        : '';

    document.getElementById('recoveryMsg').innerHTML =
        `<strong>${lines.join(', ')}</strong>${activePart}<br>` +
        `<span style="opacity:0.6;">Session from ${new Date(s.timestamp).toLocaleTimeString()}</span>`;
    document.getElementById('recoveryBanner').style.display = 'block';
}

export async function resumeSession() {
    const s = loadSession(false);
    if (!s) { dismissSession(); return; }

    document.getElementById('recoveryBanner').style.display = 'none';
    document.getElementById('btnResumeSession').disabled = true;

    // --- 1. Restore global config state ---
    setCurrentAnimationGrid(s.selectedAnimations || []);
    setActiveSpriteSize(s.spriteSize || 64);

    // --- 2. Restore canvas from snapshot ---
    const canvas = document.getElementById('spriteCanvas');
    const framesCount = s.framesCount || 8;
    canvas.width = activeSpriteSize * framesCount;
    canvas.height = activeSpriteSize * (s.selectedAnimations || []).length;
    canvas.style.display = 'block';
    document.getElementById('canvasEmptyMsg').style.display = 'none';
    const newCtx = canvas.getContext('2d');
    setCanvasCtx(newCtx);
    newCtx.imageSmoothingEnabled = false; // crisp pixel-art scaling

    if (s.canvasData) {
        await new Promise(resolve => {
            const img = new Image();
            img.onload = () => { newCtx.drawImage(img, 0, 0); resolve(); };
            img.onerror = resolve;
            img.src = s.canvasData;
        });
    }

    // --- 3. Rebuild timeline rows ---
    document.getElementById('stage3Progress').style.display = 'block';
    const timelineContainer = document.getElementById('timelineContainer');
    timelineContainer.innerHTML = '';
    const rowStatuses = {};

    (s.selectedAnimations || []).forEach((animId, rowIndex) => {
        const preset = ANIMATION_PRESETS.find(a => a.id === animId);
        const frames = s.completedFrames?.[animId] || [];
        const done = frames.filter(Boolean).length;

        const rowDiv = document.createElement('div');
        rowDiv.className = 'timeline-row';
        rowDiv.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px; background:rgba(255,255,255,0.03); border-radius:6px; font-size:12px;';

        const label = document.createElement('div');
        label.style.cssText = 'width:80px; font-weight:bold;';
        label.innerText = preset?.name || animId;
        rowDiv.appendChild(label);

        const framesDiv = document.createElement('div');
        framesDiv.id = `timeline_${animId}`;
        framesDiv.style.cssText = 'letter-spacing:2px; flex:1;';
        framesDiv.innerText = '\u2705'.repeat(done) + '\u2b1c'.repeat(framesCount - done);
        rowDiv.appendChild(framesDiv);

        const playBtn = document.createElement('button');
        playBtn.innerText = '\u25b6\ufe0f Play';
        playBtn.style.cssText = 'padding:2px 8px; font-size:10px; cursor:pointer; background:var(--accent-glow); border:1px solid var(--accent); color:var(--accent); border-radius:4px;';
        playBtn.style.display = done === framesCount ? 'block' : 'none';
        playBtn.onclick = () => playAnimationLoop(animId, rowIndex, framesCount);
        rowDiv.appendChild(playBtn);

        const retryRowBtn = document.createElement('button');
        retryRowBtn.innerText = '\u267b\ufe0f';
        retryRowBtn.title = 'Retry entire row';
        retryRowBtn.style.cssText = 'padding:2px 6px; font-size:10px; cursor:pointer; background:transparent; border:1px solid var(--border); color:var(--text-muted); border-radius:4px;';
        retryRowBtn.style.display = done > 0 ? 'block' : 'none';
        retryRowBtn.onclick = () => retryAnimationRow(animId, rowIndex, framesCount);
        rowDiv.appendChild(retryRowBtn);

        timelineContainer.appendChild(rowDiv);
        rowStatuses[animId] = { div: framesDiv, playBtn, retryRowBtn, pose: preset?.pose };
    });

    const allDone = (s.selectedAnimations || []).every(id => {
        const frames = s.completedFrames?.[id] || [];
        return frames.filter(Boolean).length === framesCount;
    });

    if (allDone) {
        document.getElementById('downloadSheetBtn').style.display = 'block';
        document.getElementById('downloadZipBtn').style.display = 'block';
        document.getElementById('exportSessionBtn').style.display = 'block';
        document.getElementById('importSessionLabel').style.display = 'block';
        document.getElementById('btnReorderFrames').style.display = 'block';
        setSpriteStatus('\u2728 Session restored \u2014 generation was complete!', 'success');
        return;
    }

    // --- 4. Reconnect to active poll or restart from missing frame ---
    setBaseRefUploadName(s.baseRefUploadName || null);
    const activeAnimId = s.activeAnimId;
    const activePromptId = s.activePromptId;
    const startFrameIndex = s.activeFrameIndex ?? 0;

    if (!baseRefUploadName) {
        setSpriteStatus('\u26a0\ufe0f Cannot resume \u2014 base reference upload name missing. Please regenerate.', 'error');
        return;
    }

    setSpriteStatus('\u23f3 Reconnecting to active generation...', 'active');
    showSpriteProgress(true);
    initWebSocket();

    try {
        let currentFrameRefImg = s.lastFrameRefImg || baseRefUploadName;

        if (activePromptId) {
            const rowIndex = (s.selectedAnimations || []).indexOf(activeAnimId);
            setSpriteStatus(`Reconnecting to ${activeAnimId} frame ${startFrameIndex + 1}...`, 'active');
            try {
                const filename = await pollHistory(activePromptId);
                const imgUrl = `http://${COMFY_API_LIVE}/view?filename=${filename}&type=output&t=${Date.now()}`;
                await new Promise((resolve, reject) => {
                    const img = new Image(); img.crossOrigin = 'Anonymous';
                    img.onload = () => {
                        canvasCtx.drawImage(img, startFrameIndex * activeSpriteSize, rowIndex * activeSpriteSize, activeSpriteSize, activeSpriteSize);
                        resolve();
                    };
                    img.onerror = reject; img.src = imgUrl;
                });
                const updatedFrames = s.completedFrames || {};
                if (!updatedFrames[activeAnimId]) updatedFrames[activeAnimId] = [];
                updatedFrames[activeAnimId][startFrameIndex] = filename;
                const blobRes = await fetch(imgUrl);
                const blob = await blobRes.blob();
                currentFrameRefImg = await uploadImageToComfy(blob, `recur_resume_${activeAnimId}_${startFrameIndex}.png`);
                saveSession({ completedFrames: updatedFrames, activePromptId: null, canvasData: canvas.toDataURL() });

                if (rowStatuses[activeAnimId]) {
                    const doneNow = updatedFrames[activeAnimId].filter(Boolean).length;
                    rowStatuses[activeAnimId].div.innerText = '\u2705'.repeat(doneNow) + '\u2b1c'.repeat(framesCount - doneNow);
                }
            } catch (pollErr) {
                console.warn('Reconnect poll failed:', pollErr);
            }
        }

        // --- 5. Async iteration code here has been hoisted to app.js for dependency scope...
        // (We will let app.js loop `startAnimationQueue` when it resumes).

    } catch (err) {
        console.error('Resume failed:', err);
        setSpriteStatus(`\u274c Resume error: ${err.message}`, 'error');
        showSpriteProgress(false);
    }
}

// ============================================================
//  SESSION EXPORT / IMPORT
// ============================================================
export function exportSessionJSON() {
    const session = loadSession(false);
    const exportData = {
        _exportedAt: new Date().toISOString(),
        _version: 1,
        selectedAnimations: session?.selectedAnimations || currentAnimationGrid,
        framesCount: session?.framesCount || parseInt(document.getElementById('frameCountSlider')?.value) || 8,
        spriteSize: session?.spriteSize || activeSpriteSize,
        denoise: session?.denoise || parseFloat(document.getElementById('denoiseSlider')?.value) || 0.35,
        basePositivePrompt: session?.basePositivePrompt || document.getElementById('spritePrompt')?.value || '',
        baseNegativePrompt: session?.baseNegativePrompt || '',
        poseOverrides: session?.poseOverrides || {},
        completedFrames: session?.completedFrames || {},
        baseRefUploadName: session?.baseRefUploadName || null,
        loraName: session?.loraName || document.getElementById('loraInput')?.value.trim() || ''
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const promptSlug = (exportData.basePositivePrompt || 'session').slice(0, 20).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    a.download = `epoch_session_${promptSlug}_${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    setSpriteStatus('📤 Session exported to JSON!', 'success');
}

export function importSessionJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.selectedAnimations || !data.framesCount) throw new Error('Invalid session file \u2014 missing required fields.');
            saveSession(data);

            if (data.loraName !== undefined) {
                const loraEl = document.getElementById('loraInput');
                if (loraEl) loraEl.value = data.loraName;
            }

            setSpriteStatus('📥 Session JSON imported! Tap Resume to restore.', 'success');
            document.getElementById('recoveryBanner').style.display = 'block';
        } catch (err) {
            setSpriteStatus(`\u274c Session import failed: ${err.message}`, 'error');
        }
    };
    reader.readAsText(file);
}
