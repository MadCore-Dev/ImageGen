// ============================================================
//  MAIN GENERATOR ORCHESTRATION & APP INIT
// ============================================================

// --- UI / Navigation Events ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (tabBtn) tabBtn.classList.add('active');
}

function setTabActivity(tabId, active) {
    const btn = document.getElementById(`btnTab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
    if (btn) btn.classList.toggle('has-activity', active);
}

function updateCharCount() {
    const v = document.getElementById('promptInput').value.length;
    const el = document.getElementById('charCount');
    el.textContent = v;
    el.className = 'char-count' + (v >= 300 ? ' danger' : v >= 200 ? ' warn' : '');
}

function updateNegCount() {
    const v = document.getElementById('negativeInput').value.length;
    const el = document.getElementById('negCount');
    el.textContent = v;
    el.className = 'char-count' + (v >= 300 ? ' danger' : v >= 200 ? ' warn' : '');
}

function toggleInfo(id) {
    const el = document.getElementById(id);
    const wasVisible = el.classList.contains('visible');
    document.querySelectorAll('.info-tooltip').forEach(t => t.classList.remove('visible'));
    if (!wasVisible) el.classList.add('visible');
}

document.addEventListener('click', e => {
    if (!e.target.closest('.control-item')) {
        document.querySelectorAll('.info-tooltip').forEach(t => t.classList.remove('visible'));
    }
});

function toggleHistoryPanel() {
    const list = document.getElementById('historyList');
    const chv = document.getElementById('historyChevron');
    const isOpen = list.classList.contains('open');
    if (isOpen) {
        list.classList.remove('open');
        chv.textContent = '▼';
    } else {
        list.classList.add('open');
        chv.textContent = '▲';
    }
}

// --- Status + Visuals ---
function setStatus(msg, state = 'idle') {
    const bar = document.getElementById('statusBar');
    const text = document.getElementById('statusText');
    bar.className = 'status-bar ' + state;
    text.textContent = msg;
}

function setProgress(pc) {
    const isSpriteTab = document.getElementById('tab-spritegen').classList.contains('active');
    if (isSpriteTab) {
        const sBar = document.getElementById('spriteProgressBar');
        if (sBar) sBar.style.width = `${pc}%`;
        const pct = document.getElementById('spriteStatusPct');
        if (pct) pct.textContent = `${pc}%`;
    } else {
        const bar = document.getElementById('progressBar');
        if (bar) bar.style.width = `${pc}%`;
        const pct = document.getElementById('statusPct');
        if (pct) pct.textContent = `${pc}%`;
    }
}

function setSpriteStatus(msg, state = 'idle') {
    const bar = document.getElementById('spriteStatusBar');
    const text = document.getElementById('spriteStatusText');
    if (!bar || !text) return;
    bar.style.display = 'flex';
    bar.className = 'status-bar ' + state;
    text.textContent = msg;
}

const TIPS = [
    '💡 Lower CFG (1.0 for FLUX) keeps images more creative',
    '💡 FLUX Schnell generates in ~4 steps — fast & sharp',
    '💡 Add "isolated on white background" for cleaner sprites',
    '💡 Increase Denoise for more variation, decrease for consistency',
    '💡 Style chips inject hidden keywords — mix-and-match them',
    '💡 Export your session JSON to back up your sprite config',
    '💡 Frame 1 sets the character identity — nail the reference first',
    '💡 Try "full body, front-facing" for walking animations',
    '💡 The FPS slider controls GIF playback speed after export',
    '💡 Batch mode (1–4) lets you compare prompt variations',
    '💡 Lower denoising = smoother frame transitions',
    '💡 Traffic Cop manages VRAM — it will auto-restart ComfyUI if needed',
    '💡 You can resume any interrupted session from the recovery banner',
];
let _tipInterval = null;
let _tipIndex = 0;

function startTipCycle(elId) {
    stopTipCycle();
    const el = document.getElementById(elId);
    if (!el) return;
    _tipIndex = Math.floor(Math.random() * TIPS.length);
    el.textContent = TIPS[_tipIndex];
    _tipInterval = setInterval(() => {
        _tipIndex = (_tipIndex + 1) % TIPS.length;
        if (el) el.textContent = TIPS[_tipIndex];
    }, 4000);
}

function stopTipCycle() {
    clearInterval(_tipInterval);
    _tipInterval = null;
    const t1 = document.getElementById('tipText');
    const t2 = document.getElementById('spriteTipText');
    if (t1) t1.textContent = '';
    if (t2) t2.textContent = '';
}

function showProgress(visible) {
    document.getElementById('progressContainer').classList.toggle('visible', visible);
    document.getElementById('result-container')?.classList.toggle('skeleton-shimmer', visible);
    if (visible) startTipCycle('tipText');
    else { stopTipCycle(); setProgress(0); }
}

function showSpriteProgress(visible) {
    const c = document.getElementById('spriteProgressContainer');
    if (c) c.classList.toggle('visible', visible);
    document.getElementById('spriteLoaderWrap')?.classList.toggle('skeleton-shimmer', visible);
    if (visible) startTipCycle('spriteTipText');
    else { stopTipCycle(); setProgress(0); }
}

// --- App State Initializers ---
function applyTheme() {
    const saved = localStorage.getItem('setting_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
}

function initThemeSwitcher() {
    applyTheme();
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('setting_theme', next);
}

// --- Prompt History ---
const HISTORY_KEY = 'epoch_prompt_history';
function savePromptHistory(prompt, imgDataUrl) {
    if (!prompt || !imgDataUrl) return;
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        let history = raw ? JSON.parse(raw) : [];
        history.unshift({ prompt, thumb: imgDataUrl, time: Date.now() });
        if (history.length > 20) history = history.slice(0, 20);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        renderPromptHistory();
    } catch (e) { console.warn('Failed to save history', e); }
}

function renderPromptHistory() {
    const panel = document.getElementById('historyPanel');
    const list = document.getElementById('historyList');
    if (!panel || !list) return;
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        const history = raw ? JSON.parse(raw) : [];
        if (history.length === 0) {
            panel.style.display = 'none';
            return;
        }
        panel.style.display = 'block';
        list.innerHTML = '';
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.onclick = () => { document.getElementById('promptInput').value = item.prompt; updateCharCount(); };
            div.innerHTML = `
        <img src="${item.thumb}" class="history-thumb" alt="thumb">
        <div class="history-text" title="${item.prompt}">${item.prompt}</div>
      `;
            list.appendChild(div);
        });
    } catch (e) { }
}

function clearPromptHistory() {
    localStorage.removeItem(HISTORY_KEY);
    renderPromptHistory();
}

// --- Image Metadata UI ---
function updateImageMeta() {
    const m = document.getElementById('imageMeta');
    m.classList.add('visible');

    document.getElementById('metaModel').textContent = selectedModel.name.split('.')[0] || selectedModel.name;
    document.getElementById('metaRes').textContent = `${imgWidth}×${imgHeight}`;
    document.getElementById('metaSteps').textContent = document.getElementById('stepsSlider').value + ' steps';
    document.getElementById('metaCfg').textContent = 'cfg ' + document.getElementById('cfgSlider').value;
    document.getElementById('metaSeed').textContent = 'seed: ' + lastSeed;

    const seedBtn = document.getElementById('lockSeedBtn');
    seedBtn.classList.add('active');
    setTimeout(() => seedBtn.classList.remove('active'), 500);
}

// --- Styles Management ---
function selectStyle(chip) {
    document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const sId = chip.dataset.style;
    const styleObj = STYLE_MAP[sId];

    const modelChip = document.querySelector(`.model-chip[data-model="${styleObj.modelName}"]`);
    if (modelChip) selectModel(modelChip);

    activeStyleKw.positive = styleObj.positiveKw;
    activeStyleKw.negative = styleObj.negativeKw;

    document.getElementById('styleKeywordsBar').style.display = 'block';
    document.getElementById('styleKeywordsTags').textContent = styleObj.positiveKw;
}

function clearStyle() {
    document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
    activeStyleKw.positive = '';
    activeStyleKw.negative = '';
    document.getElementById('styleKeywordsBar').style.display = 'none';
}

function copyOutputPath() {
    const path = document.getElementById('outputFolderPath').textContent;
    const label = document.getElementById('copyOutputLabel');
    navigator.clipboard.writeText(path).then(() => {
        label.textContent = '✓ Copied!';
        setTimeout(() => { label.textContent = '📋 Copy'; }, 2000);
    }).catch(() => {
        const range = document.createRange();
        range.selectNode(document.getElementById('outputFolderPath'));
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        label.textContent = '⌘C to copy';
        setTimeout(() => { label.textContent = '📋 Copy'; window.getSelection().removeAllRanges(); }, 2500);
    });
}

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
const _originalGenerateImage = async function () {
    const userPositive = document.getElementById('promptInput').value.trim();
    const userNegative = document.getElementById('negativeInput').value.trim();

    const positivePrompt = activeStyleKw.positive ? `${userPositive}, ${activeStyleKw.positive}` : userPositive;
    const negativePrompt = activeStyleKw.negative ? `${userNegative}${userNegative ? ', ' : ''}${activeStyleKw.negative}` : userNegative;

    if (!positivePrompt) {
        setStatus('Please enter a prompt first.', 'error');
        return;
    }

    const btn = document.getElementById('generateBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Generating…';
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
        const copRes = await fetch(`${TRAFFIC_COP_LIVE}/comfyui/start`, { method: 'POST' });
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow, client_id: CLIENT_ID })
        });
        if (!queueRes.ok) {
            const errText = await queueRes.text();
            throw new Error(`Queue failed (HTTP ${queueRes.status}): ${errText}`);
        }
        const { prompt_id } = await queueRes.json();
        setStatus(`⏳ In queue (${prompt_id.slice(0, 8)})… Node progress shown in bar above`, 'active');

        const filename = await pollHistory(prompt_id);
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
        imgEl.src = `http://${COMFY_API_LIVE}/view?filename=${filename}&type=output`;

    } catch (err) {
        console.error(err);
        setStatus(`❌ ${err.message}`, 'error');
        document.getElementById('loaderWrap').classList.remove('visible');
        document.getElementById('emptyState').style.display = '';
        showProgress(false);
    } finally {
        btn.disabled = false;
        btn.textContent = '✦ Generate Image';
        setTabActivity('imagegen', false);
        checkComfyStatus();
    }
};

let generateImage = async function () {
    const n = _batchCount;
    if (n === 1) { return _originalGenerateImage(); }

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

    for (let i = 0; i < n; i++) {
        btn.textContent = `⏳ Batch ${i + 1}/${n}…`;
        try {
            await _originalGenerateImage();
            const src = document.getElementById('resultImage').src;
            if (src) {
                cards[i].innerHTML = `<img src="${src}" alt="Batch image ${i + 1}">
          <button class="batch-dl" onclick="downloadBatchImage('${src}', ${i + 1})" aria-label="Download batch image ${i + 1}">⬇</button>`;
            }
        } catch (e) {
            cards[i].innerHTML = `<div style="color:var(--error);font-size:11px;padding:8px;">❌ ${e.message}</div>`;
        }
    }

    btn.disabled = false;
    btn.textContent = `✦ Generate ${n} Images`;
    setStatus(`✅ Batch of ${n} complete!`, 'success');
};


// ⌨️ Keyboard Shortcuts (Cmd+Enter)
document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        const isSpriteTab = document.getElementById('tab-spritegen').classList.contains('active');

        if (!isSpriteTab) {
            if (!document.getElementById('generateBtn').disabled) generateImage();
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
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    applyTheme();
    renderPromptHistory();
    initAnimationPicker();
    updateResolutionPresets('gguf');
    initCanvasEventListeners();
    checkForRecovery();

    const initialChip = document.querySelector('.model-chip.active');
    if (initialChip) { selectModel(initialChip); }
});

if (document.readyState !== 'loading') {
    loadSettings();
    applyTheme();
    renderPromptHistory();
    initAnimationPicker();
    updateResolutionPresets('gguf');
    initCanvasEventListeners();
    checkForRecovery();
}
