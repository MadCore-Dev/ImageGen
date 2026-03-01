import {
    COMFY_API_LIVE, setComfyApiLive,
    TRAFFIC_COP_LIVE, setTrafficCopLive,
    OUTPUT_PATH_LIVE, setOutputPathLive,
    CLIENT_ID, wsRetries, setWsRetries, socket,
    lastSeed, setLastSeed,
    lastFilename, selectedModel,
    imgWidth, setImgWidth,
    imgHeight, setImgHeight,
    activeStyleKw,
    MODEL_SPECS, STYLE_MAP
} from './config.js';
import {
    switchTab, setTabActivity, updateCharCount, updateNegCount, toggleInfo, toggleHistoryPanel,
    setStatus, setProgress, setSpriteStatus, startTipCycle, stopTipCycle, showProgress, showSpriteProgress,
    applyTheme, toggleTheme, savePromptHistory, renderPromptHistory, clearPromptHistory,
    updateImageMeta, selectStyle, clearStyle, copyOutputPath
} from './ui.js';
import { checkComfyStatus, initWebSocket, pollHistory } from './api.js';
import { buildWorkflow } from './workflows.js';
import { checkForRecovery } from './session.js';
import { initCanvasEventListeners } from './canvas.js';
import { selectSpriteModel, initAnimationPicker, resumeAnimationQueue } from './sprite_engine.js';

// ============================================================
//  MAIN GENERATOR ORCHESTRATION & APP INIT
// ============================================================

// --- UI / Navigation Events ---

function downloadImage() {
    const img = document.getElementById('resultImage');
    if (!img.src) return;
    const a = document.createElement('a');
    a.href = img.src;
    const promptText = document.getElementById('promptInput').value || 'epoch_image';
    const slug = promptText.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').substring(0, 30);
    a.download = `${slug}_${lastSeed}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// --- Batch Config ---
let _batchCount = 1;
function setBatchCount(n) {
    _batchCount = n;
    document.querySelectorAll('.batch-pill').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.count) === n);
    });
    const btn = document.getElementById('generateBtn');
    btn.textContent = n > 1 ? `✦ Generate ${n} Images` : '✦ Generate Image';
}

function downloadBatchImage(src, idx) {
    const a = document.createElement('a');
    a.href = src;
    a.download = `epoch_batch_${idx}_${Date.now()}.png`;
    a.click();
}

// --- Core Generation Orchestration ---
let _tab1AbortController = null;

/** Syncs bottom nav active state with the given tab ID */
function syncBottomNav(tabId) {
    document.querySelectorAll('.bottom-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `btnBottomTab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
    });
}

export function cancelGenerateImage() {
    if (_tab1AbortController) {
        _tab1AbortController.abort();
    }
}

const _originalGenerateImage = async function (signal, isBatchRun = false) {
    const userPositive = document.getElementById('promptInput').value.trim();
    const userNegative = document.getElementById('negativeInput').value.trim();

    const positivePrompt = activeStyleKw.positive ? `${userPositive}, ${activeStyleKw.positive}` : userPositive;
    const negativePrompt = activeStyleKw.negative ? `${userNegative}${userNegative ? ', ' : ''}${activeStyleKw.negative}` : userNegative;

    if (!positivePrompt) {
        setStatus('Please enter a prompt first.', 'error');
        return;
    }

    const btn = document.getElementById('generateBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Generating…';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    setTabActivity('imagegen', true);

    document.getElementById('resultImage').style.display = 'none';
    document.getElementById('resultImage').src = '';
    document.getElementById('result-container').classList.remove('has-image');
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('downloadBtn').classList.remove('visible');
    document.getElementById('imageMeta').classList.remove('visible');
    document.getElementById('loaderWrap').classList.add('visible');
    document.getElementById('loaderLabel').textContent = 'Contacting Traffic Cop…';
    showProgress(true);
    setProgress(0);
    setStatus('🚦 Contacting Traffic Cop: Preparing hardware…', 'active');

    try {
        const copRes = await fetch(`${TRAFFIC_COP_LIVE}/comfyui/start`, { method: 'POST', signal });
        const copData = await copRes.json();
        if (copData.status !== 'success') {
            throw new Error(`Traffic Cop failed: ${copData.message || 'Could not start ComfyUI'}`);
        }

        wsRetries = 0;
        initWebSocket();

        setStatus(`🎨 ComfyUI Ready. Queuing ${selectedModel.name.replace('.safetensors', '')} workflow…`, 'active');
        document.getElementById('loaderLabel').textContent = 'Queueing prompt...';

        const workflow = await buildWorkflow(positivePrompt, negativePrompt);

        const queueRes = await fetch(`http://${COMFY_API_LIVE}/prompt`, {
            signal,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow, client_id: CLIENT_ID }),

        });
        if (!queueRes.ok) {
            const errText = await queueRes.text();
            throw new Error(`Queue failed (HTTP ${queueRes.status}): ${errText}`);
        }
        const { prompt_id } = await queueRes.json();
        setStatus(`⏳ In queue (${prompt_id.slice(0, 8)})… Node progress shown in bar above`, 'active');

        const filename = await pollHistory(prompt_id, signal);
        lastFilename = filename;

        setStatus('✅ Image ready!', 'success');
        document.getElementById('loaderLabel').textContent = 'Fetching image…';

        const imgEl = document.getElementById('resultImage');
        imgEl.onload = () => {
            document.getElementById('loaderWrap').classList.remove('visible');
            imgEl.style.display = 'block';
            document.getElementById('result-container').classList.add('has-image');
            document.getElementById('emptyState').style.display = 'none';
            showProgress(false);
            document.getElementById('downloadBtn').classList.add('visible');
            updateImageMeta();
            savePromptHistory(document.getElementById('promptInput').value.trim(), imgEl.src);
        };
        imgEl.onerror = () => {
            setStatus('❌ Image loaded but could not be displayed. Check ComfyUI output folder.', 'error');
            document.getElementById('loaderWrap').classList.remove('visible');
        };
        imgEl.src = `http://${COMFY_API_LIVE}/view?filename=${filename}&type=output&t=${Date.now()}`;

    } catch (err) {
        if (err.name === 'AbortError') {
            setStatus('🚫 Generation cancelled.', 'error');
        } else {
            console.error(err);
            setStatus(`❌ ${err.message}`, 'error');
        }
        document.getElementById('loaderWrap').classList.remove('visible');
        document.getElementById('emptyState').style.display = '';
        showProgress(false);
    } finally {
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn && !isBatchRun) cancelBtn.style.display = 'none';
        btn.disabled = false;
        btn.textContent = '✦ Generate Image';
        setTabActivity('imagegen', false);
        _tab1AbortController = null;
        checkComfyStatus();
    }
};

let generateImage = async function () {
    const n = _batchCount;
    _tab1AbortController = new AbortController();
    const signal = _tab1AbortController.signal;
    if (n === 1) { return _originalGenerateImage(signal, false); }

    const btn = document.getElementById('generateBtn');
    btn.disabled = true;
    btn.textContent = `⏳ Batch 0/${n}…`;

    const grid = document.getElementById('batchGrid');
    grid.innerHTML = '';
    grid.style.display = 'grid';

    const cards = Array.from({ length: n }, (_, i) => {
        const card = document.createElement('div');
        card.className = 'batch-item';
        card.innerHTML = `<div style="color:var(--text-dim);font-size:12px;">⏳ ${i + 1}/${n}</div>`;
        grid.appendChild(card);
        return card;
    });

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';

    for (let i = 0; i < n; i++) {
        if (signal.aborted) break;
        btn.textContent = `⏳ Batch ${i + 1}/${n}…`;
        try {
            await _originalGenerateImage(signal, true);
            const src = document.getElementById('resultImage').src;
            if (src) {
                const dlBtn = document.createElement('button');
                dlBtn.className = 'batch-dl';
                dlBtn.setAttribute('aria-label', `Download batch image ${i + 1}`);
                dlBtn.textContent = '⬇';
                dlBtn.addEventListener('click', () => downloadBatchImage(src, i + 1));
                const img = document.createElement('img');
                img.src = src;
                img.alt = `Batch image ${i + 1}`;
                cards[i].innerHTML = '';
                cards[i].appendChild(img);
                cards[i].appendChild(dlBtn);
            }
        } catch (e) {
            if (e.name === 'AbortError') break;
            cards[i].innerHTML = `<div style="color:var(--error);font-size:11px;padding:8px;">❌ ${e.message}</div>`;
        }
    }

    if (cancelBtn) cancelBtn.style.display = 'none';
    _tab1AbortController = null;
    btn.disabled = false;
    btn.textContent = signal.aborted ? '✦ Generate Image' : `✦ Generate ${n} Images`;
    if (!signal.aborted) setStatus(`✅ Batch of ${n} complete!`, 'success');
};


// ============================================================
//  MISSING UI FUNCTIONS (Restored from before split)
// ============================================================
export function loadSettings() {
    setComfyApiLive(localStorage.getItem('setting_comfy_api') || COMFY_API_LIVE);
    setTrafficCopLive(localStorage.getItem('setting_traffic_cop') || TRAFFIC_COP_LIVE);
    setOutputPathLive(localStorage.getItem('setting_output_path') || OUTPUT_PATH_LIVE);
    const el = document.getElementById('outputFolderPath');
    if (el) el.textContent = OUTPUT_PATH_LIVE;
}

export function openSettings() {
    document.getElementById('settingComfyApi').value = COMFY_API_LIVE;
    document.getElementById('settingTrafficCop').value = TRAFFIC_COP_LIVE;
    document.getElementById('settingOutputPath').value = OUTPUT_PATH_LIVE;
    document.getElementById('settingsModal').classList.add('open');
}

export function closeSettings() {
    document.getElementById('settingsModal').classList.remove('open');
}

export function saveSettings() {
    const api = document.getElementById('settingComfyApi').value.trim();
    const tc = document.getElementById('settingTrafficCop').value.trim();
    const op = document.getElementById('settingOutputPath').value.trim();
    if (api) { localStorage.setItem('setting_comfy_api', api); setComfyApiLive(api); }
    if (tc) { localStorage.setItem('setting_traffic_cop', tc); setTrafficCopLive(tc); }
    if (op) {
        localStorage.setItem('setting_output_path', op);
        setOutputPathLive(op);
        const el = document.getElementById('outputFolderPath');
        if (el) el.textContent = op;
    }
    closeSettings();
    setWsRetries(0);
    initWebSocket();
}

// Close modal on overlay click or Escape key
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });
document.getElementById('settingsModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('settingsModal')) closeSettings();
});

export function updateResolutionPresets(type) {
    const spec = MODEL_SPECS[type] || MODEL_SPECS.sd15;
    const container = document.getElementById('presetBtns');
    if (!container) return;
    container.innerHTML = '';

    setImgWidth(spec.defaultW);
    setImgHeight(spec.defaultH);

    spec.presets.forEach((p, i) => {
        const btn = document.createElement('button');
        btn.className = 'preset-btn' + (i === 0 ? ' active' : '');
        btn.textContent = p.label;
        btn.onclick = () => setPreset(p.w, p.h, btn);
        container.appendChild(btn);
    });

    const minSizePill = document.getElementById('minSizePill');
    if (minSizePill) minSizePill.textContent = spec.minLabel;
}

export function setPreset(w, h, btn) {
    setImgWidth(w);
    setImgHeight(h);
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

export function selectModel(chip) {
    document.querySelectorAll('.model-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedModel.name = chip.dataset.model;
    selectedModel.type = chip.dataset.type;

    const type = chip.dataset.type;
    updateResolutionPresets(type);

    const stepsSlider = document.getElementById('stepsSlider');
    const cfgSlider = document.getElementById('cfgSlider');

    if (type === 'gguf') {
        stepsSlider.value = 4; document.getElementById('stepsVal').textContent = '4';
        cfgSlider.value = 1; document.getElementById('cfgVal').textContent = '1.0';
    } else if (type === 'sdxl_lightning') {
        stepsSlider.value = 6; document.getElementById('stepsVal').textContent = '6';
        cfgSlider.value = 2; document.getElementById('cfgVal').textContent = '2.0';
    } else if (type === 'sdxl') {
        stepsSlider.value = 25; document.getElementById('stepsVal').textContent = '25';
        cfgSlider.value = 7; document.getElementById('cfgVal').textContent = '7.0';
    } else {
        stepsSlider.value = 20; document.getElementById('stepsVal').textContent = '20';
        cfgSlider.value = 7; document.getElementById('cfgVal').textContent = '7.0';
    }
}

export function randomizeSeed() {
    document.getElementById('seedInput').value = '';
    document.getElementById('seedInput').placeholder = 'Random';
}

export function lockSeed() {
    if (lastSeed !== null) {
        document.getElementById('seedInput').value = lastSeed;
    } else {
        setStatus('No seed yet — generate first!', 'error');
    }
}

// ⌨️ Keyboard Shortcuts (Cmd+Enter)
document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        const isSpriteTab = document.getElementById('tab-spritegen').classList.contains('active');

        if (!isSpriteTab) {
            if (!document.getElementById('generateBtn').disabled) window.generateImage();
        } else {
            if (document.getElementById('stage2Config').style.display === 'block') {
                if (!document.getElementById('btnStartAnim').disabled) startAnimationQueue();
            } else {
                if (!document.getElementById('btnGenRef').disabled) generateSpriteRef();
            }
        }
    }
});

// App Startup Orchestration
function initApp() {
    initEventListeners();
    loadSettings();
    applyTheme();
    renderPromptHistory();
    initAnimationPicker();
    updateResolutionPresets('gguf');
    initCanvasEventListeners();
    checkForRecovery();

    const initialChip = document.querySelector('.model-chip.active');
    if (initialChip) { selectModel(initialChip); }
}

if (document.readyState !== 'loading') {
    initApp();
} else {
    document.addEventListener('DOMContentLoaded', initApp);
}

// ============================================================
//  EVENT LISTENERS BINDING
// ============================================================
export function initEventListeners() {
    const el_autoGenId_1 = document.getElementById('autoGenId_1');
    if (el_autoGenId_1) el_autoGenId_1.addEventListener('click', (e) => { closeSettings() });
    const el_autoGenId_2 = document.getElementById('autoGenId_2');
    if (el_autoGenId_2) el_autoGenId_2.addEventListener('click', (e) => { saveSettings() });
    const el_autoGenId_3 = document.getElementById('autoGenId_3');
    if (el_autoGenId_3) el_autoGenId_3.addEventListener('click', (e) => { copyOutputPath() });
    const el_autoGenId_4 = document.getElementById('autoGenId_4');
    if (el_autoGenId_4) el_autoGenId_4.addEventListener('click', (e) => { openSettings() });
    const el_themeToggle = document.getElementById('themeToggle');
    if (el_themeToggle) el_themeToggle.addEventListener('click', (e) => { toggleTheme() });
    const el_btnTabImagegen = document.getElementById('btnTabImagegen');
    if (el_btnTabImagegen) el_btnTabImagegen.addEventListener('click', (e) => { switchTab('imagegen') });
    const el_btnTabSpritegen = document.getElementById('btnTabSpritegen');
    if (el_btnTabSpritegen) el_btnTabSpritegen.addEventListener('click', (e) => { switchTab('spritegen') });
    // Bottom nav (mobile) — mirrors top tab nav
    const el_btnBottomTabImagegen = document.getElementById('btnBottomTabImagegen');
    if (el_btnBottomTabImagegen) el_btnBottomTabImagegen.addEventListener('click', () => { switchTab('imagegen'); syncBottomNav('imagegen'); });
    const el_btnBottomTabSpritegen = document.getElementById('btnBottomTabSpritegen');
    if (el_btnBottomTabSpritegen) el_btnBottomTabSpritegen.addEventListener('click', () => { switchTab('spritegen'); syncBottomNav('spritegen'); });
    // Style chips — event delegation
    document.querySelectorAll('.style-chip').forEach(chip => {
        chip.addEventListener('click', (e) => selectStyle(e.currentTarget));
    });
    const el_btnClearStyle = document.getElementById('btnClearStyle');
    if (el_btnClearStyle) el_btnClearStyle.addEventListener('click', () => clearStyle());

    // Model chips — event delegation
    document.querySelectorAll('.model-chip').forEach(chip => {
        chip.addEventListener('click', (e) => selectModel(e.currentTarget));
    });

    // Negative prompt
    const el_negativeInput = document.getElementById('negativeInput');
    if (el_negativeInput) el_negativeInput.addEventListener('input', () => updateNegCount());

    // Steps / CFG sliders + info toggles
    const el_btnToggleStepsInfo = document.getElementById('btnToggleStepsInfo');
    if (el_btnToggleStepsInfo) el_btnToggleStepsInfo.addEventListener('click', () => toggleInfo('stepsInfo'));
    const el_stepsSlider = document.getElementById('stepsSlider');
    if (el_stepsSlider) el_stepsSlider.addEventListener('input', (e) => { document.getElementById('stepsVal').textContent = e.currentTarget.value });
    const el_btnToggleCfgInfo = document.getElementById('btnToggleCfgInfo');
    if (el_btnToggleCfgInfo) el_btnToggleCfgInfo.addEventListener('click', () => toggleInfo('cfgInfo'));
    const el_cfgSlider = document.getElementById('cfgSlider');
    if (el_cfgSlider) el_cfgSlider.addEventListener('input', (e) => { document.getElementById('cfgVal').textContent = parseFloat(e.currentTarget.value).toFixed(1) });

    // Seed
    const el_btnRandomizeSeed = document.getElementById('btnRandomizeSeed');
    if (el_btnRandomizeSeed) el_btnRandomizeSeed.addEventListener('click', () => randomizeSeed());
    const el_lockSeedBtn = document.getElementById('lockSeedBtn');
    if (el_lockSeedBtn) el_lockSeedBtn.addEventListener('click', () => lockSeed());

    // Prompt + history
    const el_promptInput = document.getElementById('promptInput');
    if (el_promptInput) el_promptInput.addEventListener('input', () => updateCharCount());
    const el_historyHeader = document.getElementById('historyHeader');
    if (el_historyHeader) el_historyHeader.addEventListener('click', () => toggleHistoryPanel());
    const el_btnClearHistory = document.getElementById('btnClearHistory');
    if (el_btnClearHistory) el_btnClearHistory.addEventListener('click', (e) => { e.stopPropagation(); clearPromptHistory() });

    // Batch pills — event delegation
    document.querySelectorAll('.batch-pill').forEach(pill => {
        pill.addEventListener('click', (e) => setBatchCount(parseInt(e.currentTarget.dataset.count)));
    });

    // Tab 1 action buttons
    const el_generateBtn = document.getElementById('generateBtn');
    if (el_generateBtn) el_generateBtn.addEventListener('click', () => generateImage());
    const el_cancelBtn = document.getElementById('cancelBtn');
    if (el_cancelBtn) el_cancelBtn.addEventListener('click', () => cancelGenerateImage());
    const el_downloadBtn = document.getElementById('downloadBtn');
    if (el_downloadBtn) el_downloadBtn.addEventListener('click', () => downloadImage());

    // Session recovery
    const el_btnResumeSession = document.getElementById('btnResumeSession');
    if (el_btnResumeSession) el_btnResumeSession.addEventListener('click', async () => {
        const result = await resumeSession();
        if (result && !result.allDone) {
            resumeAnimationQueue(result);
        }
    });
    const el_btnDismissSession = document.getElementById('btnDismissSession');
    if (el_btnDismissSession) el_btnDismissSession.addEventListener('click', () => dismissSession());

    // Sprite size presets — event delegation
    document.querySelectorAll('#spriteSizeGroup .preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const size = parseInt(e.currentTarget.dataset.size);
            setSpriteSize(size, e.currentTarget);
        });
    });

    // Sprite model chips — event delegation
    document.querySelectorAll('.sprite-model-chip').forEach(chip => {
        chip.addEventListener('click', (e) => selectSpriteModel(e.currentTarget));
    });

    // Sprite ref gen
    const el_btnGenRef = document.getElementById('btnGenRef');
    if (el_btnGenRef) el_btnGenRef.addEventListener('click', () => generateSpriteRef());
    const el_btnUploadRef = document.getElementById('btnUploadRef');
    if (el_btnUploadRef) el_btnUploadRef.addEventListener('click', () => document.getElementById('fileUploadRef').click());
    const el_fileUploadRef = document.getElementById('fileUploadRef');
    if (el_fileUploadRef) el_fileUploadRef.addEventListener('change', (e) => handleCustomUpload(e));
    const el_btnApproveRef = document.getElementById('btnApproveRef');
    if (el_btnApproveRef) el_btnApproveRef.addEventListener('click', () => approveReference());

    // Animation queue controls
    const el_frameCountSlider = document.getElementById('frameCountSlider');
    if (el_frameCountSlider) el_frameCountSlider.addEventListener('input', (e) => { document.getElementById('frameCountVal').innerText = e.currentTarget.value });
    const el_denoiseSlider = document.getElementById('denoiseSlider');
    if (el_denoiseSlider) el_denoiseSlider.addEventListener('input', (e) => { document.getElementById('denoiseVal').innerText = e.currentTarget.value });
    const el_btnStartAnim = document.getElementById('btnStartAnim');
    if (el_btnStartAnim) el_btnStartAnim.addEventListener('click', () => startAnimationQueue());
    const el_btnCancelAnim = document.getElementById('btnCancelAnim');
    if (el_btnCancelAnim) el_btnCancelAnim.addEventListener('click', () => cancelAnimationQueue());

    // Frame reorder
    const el_btnApplyFrameOrder = document.getElementById('btnApplyFrameOrder');
    if (el_btnApplyFrameOrder) el_btnApplyFrameOrder.addEventListener('click', () => applyFrameReorder());
    const el_btnHideFrameOrder = document.getElementById('btnHideFrameOrder');
    if (el_btnHideFrameOrder) el_btnHideFrameOrder.addEventListener('click', () => hideFrameReorder());

    // Sheet download + export
    const el_downloadSheetBtn = document.getElementById('downloadSheetBtn');
    if (el_downloadSheetBtn) el_downloadSheetBtn.addEventListener('click', () => downloadSpriteSheet());
    const el_downloadZipBtn = document.getElementById('downloadZipBtn');
    if (el_downloadZipBtn) el_downloadZipBtn.addEventListener('click', () => downloadFramesZip());
    const el_btnReorderFrames = document.getElementById('btnReorderFrames');
    if (el_btnReorderFrames) el_btnReorderFrames.addEventListener('click', () => showFrameReorder());
    const el_exportSessionBtn = document.getElementById('exportSessionBtn');
    if (el_exportSessionBtn) el_exportSessionBtn.addEventListener('click', () => exportSessionJSON());
    const el_importSessionInput = document.getElementById('importSessionInput');
    if (el_importSessionInput) el_importSessionInput.addEventListener('change', (e) => importSessionJSON(e));

    // Cell preview modal
    const el_btnCloseCellPreview = document.getElementById('btnCloseCellPreview');
    if (el_btnCloseCellPreview) el_btnCloseCellPreview.addEventListener('click', () => closeCellPreview());

    // GIF / FPS
    const el_fpsSlider = document.getElementById('fpsSlider');
    if (el_fpsSlider) el_fpsSlider.addEventListener('input', (e) => updatePreviewFps(e.currentTarget.value));
    const el_btnRetryCell = document.getElementById('btnRetryCell');
    if (el_btnRetryCell) el_btnRetryCell.addEventListener('click', () => retryActiveCell());
    const el_btnCopyFrame = document.getElementById('btnCopyFrame');
    if (el_btnCopyFrame) el_btnCopyFrame.addEventListener('click', () => copyFrameToClipboard());
    const el_btnDownloadGif = document.getElementById('btnDownloadGif');
    if (el_btnDownloadGif) el_btnDownloadGif.addEventListener('click', () => exportActiveAnimationGif());
}

// Ensure initEventListeners is available for any dynamic invocations if needed, though initApp() handles it.
window.initEventListeners = initEventListeners;
