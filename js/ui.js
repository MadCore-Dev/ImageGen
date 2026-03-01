import {
    TRAFFIC_COP_LIVE, COMFY_API_LIVE, OUTPUT_PATH_LIVE, lastSeed, selectedModel, imgWidth, imgHeight, STYLE_MAP, activeStyleKw, setComfyApiLive, setTrafficCopLive, setOutputPathLive, setWsRetries, setImgWidth, setImgHeight, MODEL_SPECS
} from './config.js';

// --- UI / Navigation Events ---
export function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (tabBtn) tabBtn.classList.add('active');
}

export function setTabActivity(tabId, active) {
    const btn = document.getElementById(`btnTab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
    if (btn) btn.classList.toggle('has-activity', active);
}

export function updateCharCount() {
    const v = document.getElementById('promptInput').value.length;
    const el = document.getElementById('charCount');
    el.textContent = v;
    el.className = 'char-count' + (v >= 300 ? ' danger' : v >= 200 ? ' warn' : '');
}

export function updateNegCount() {
    const v = document.getElementById('negativeInput').value.length;
    const el = document.getElementById('negCount');
    el.textContent = v;
    el.className = 'char-count' + (v >= 300 ? ' danger' : v >= 200 ? ' warn' : '');
}

export function toggleInfo(id) {
    const el = document.getElementById(id);
    const wasVisible = el.classList.contains('visible');
    document.querySelectorAll('.info-tooltip').forEach(t => t.classList.remove('visible'));
    if (!wasVisible) el.classList.add('visible');
}

export function toggleHistoryPanel() {
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
export function setStatus(msg, state = 'idle') {
    const bar = document.getElementById('statusBar');
    const text = document.getElementById('statusText');
    if (bar) bar.className = 'status-bar ' + state;
    if (text) text.textContent = msg;
}

export function setProgress(pc) {
    const tabSpriteGen = document.getElementById('tab-spritegen');
    const isSpriteTab = tabSpriteGen && tabSpriteGen.classList.contains('active');

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

export function setSpriteStatus(msg, state = 'idle') {
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

export function startTipCycle(elId) {
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

export function stopTipCycle() {
    clearInterval(_tipInterval);
    _tipInterval = null;
    const t1 = document.getElementById('tipText');
    const t2 = document.getElementById('spriteTipText');
    if (t1) t1.textContent = '';
    if (t2) t2.textContent = '';
}

export function showProgress(visible) {
    document.getElementById('progressContainer').classList.toggle('visible', visible);
    document.getElementById('result-container')?.classList.toggle('skeleton-shimmer', visible);
    if (visible) startTipCycle('tipText');
    else { stopTipCycle(); setProgress(0); }
}

export function showSpriteProgress(visible) {
    const c = document.getElementById('spriteProgressContainer');
    if (c) c.classList.toggle('visible', visible);
    document.getElementById('spriteLoaderWrap')?.classList.toggle('skeleton-shimmer', visible);
    if (visible) startTipCycle('spriteTipText');
    else { stopTipCycle(); setProgress(0); }
}

export function setVideoStatus(msg, state = 'idle') {
    const bar = document.getElementById('videoStatusBar');
    const text = document.getElementById('videoStatusText');
    if (!bar || !text) return;
    bar.style.display = 'flex';
    bar.className = 'status-bar ' + state;
    text.textContent = msg;
}

export function setVideoProgress(pc) {
    const bar = document.getElementById('videoProgressBar');
    if (bar) bar.style.width = `${pc}%`;
    const pct = document.getElementById('videoStatusPct');
    if (pct) pct.textContent = `${pc}%`;
}

export function showVideoProgress(visible) {
    const c = document.getElementById('videoProgressContainer');
    if (c) c.classList.toggle('visible', visible);
    if (visible) startTipCycle('videoTipText');
    else { setVideoProgress(0); stopTipCycle(); }
}

// --- App State Initializers ---
export function applyTheme() {
    const saved = localStorage.getItem('setting_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
}

export function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('setting_theme', next);
}

// --- Prompt History ---
const HISTORY_KEY = 'epoch_prompt_history';

export function savePromptHistory(prompt, imgDataUrl) {
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

export function renderPromptHistory() {
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
            div.addEventListener('click', () => {
                document.getElementById('promptInput').value = item.prompt;
                updateCharCount();
            });
            div.innerHTML = `
        <img src="${item.thumb}" class="history-thumb" alt="thumb">
        <div class="history-text" title="${item.prompt}">${item.prompt}</div>
      `;
            list.appendChild(div);
        });
    } catch (e) { }
}

export function clearPromptHistory() {
    localStorage.removeItem(HISTORY_KEY);
    renderPromptHistory();
}

// --- Image Metadata UI ---
export function updateImageMeta() {
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
export function selectStyle(chip) {
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

export function clearStyle() {
    document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
    activeStyleKw.positive = '';
    activeStyleKw.negative = '';
    document.getElementById('styleKeywordsBar').style.display = 'none';
}

export function copyOutputPath() {
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
