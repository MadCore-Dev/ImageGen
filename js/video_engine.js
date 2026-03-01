import {
    TRAFFIC_COP_LIVE, COMFY_API_LIVE, CLIENT_ID,
    selectedVideoModel, videoFrameCount, videoFps, videoImgWidth, videoImgHeight,
    ANIMATEDIFF_DEFAULTS,
    setSelectedVideoModel
} from './config.js';
import { pollHistory } from './api.js';
import { buildAnimateDiffWorkflow } from './workflows.js';
import {
    setVideoStatus, showVideoProgress, setVideoProgress, setTabActivity
} from './ui.js';
import { saveTabState } from './session.js';

// ============================================================
//  TAB 3 — ANIMATEDIFF VIDEO ENGINE
// ============================================================

let _videoAbortController = null;
let _videoCancelFlag = false;

export function cancelVideoGen() {
    _videoCancelFlag = true;
    if (_videoAbortController) _videoAbortController.abort();
    // Also tell ComfyUI backend to halt the GPU process
    try {
        fetch(`http://${COMFY_API_LIVE}/interrupt`, { method: 'POST' }).catch(() => { });
        fetch(`http://${COMFY_API_LIVE}/queue`, {
            method: 'POST',
            body: JSON.stringify({ clear: true })
        }).catch(() => { });
    } catch (e) { console.error('Failed to interrupt ComfyUI:', e); }
}

export function selectVideoModel(chip) {
    document.querySelectorAll('.video-model-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    setSelectedVideoModel({
        name: chip.dataset.model,
        type: 'sd15',
        label: chip.textContent.trim()
    });
}

export async function startVideoGen() {
    const prompt = document.getElementById('videoPrompt')?.value.trim();
    if (!prompt) {
        setVideoStatus('Please enter a prompt.', 'error');
        document.getElementById('videoStatusBar').style.display = 'flex';
        return;
    }

    const negPrompt = document.getElementById('videoNegPrompt')?.value.trim()
        || 'watermark, text, blurry, low quality, deformed, duplicate frames, bad anatomy';

    const frameCount = parseInt(document.getElementById('videoFrameSlider')?.value) || ANIMATEDIFF_DEFAULTS.frameCount;
    const fps = parseInt(document.getElementById('videoFpsSlider')?.value) || ANIMATEDIFF_DEFAULTS.fps;
    const width = ANIMATEDIFF_DEFAULTS.width;
    const height = ANIMATEDIFF_DEFAULTS.height;

    _videoAbortController = new AbortController();
    _videoCancelFlag = false;
    const signal = _videoAbortController.signal;

    const btn = document.getElementById('btnStartVideo');
    const cancelBtn = document.getElementById('btnCancelVideo');
    btn.disabled = true;
    btn.textContent = '⏳ Animating…';
    cancelBtn.style.display = 'block';
    cancelBtn.disabled = false;

    setVideoStatus('🚦 Waking up ComfyUI…', 'active');
    showVideoProgress(true);
    setVideoProgress(0);
    setTabActivity('videogen', true);

    try {
        // 1. Wake ComfyUI via TrafficCop
        const copRes = await fetch(`${TRAFFIC_COP_LIVE}/comfyui/start`, {
            method: 'POST', signal
        });
        const copData = await copRes.json();
        if (copData.status !== 'success') {
            throw new Error(`Traffic Cop failed: ${copData.message || 'Could not start ComfyUI'}`);
        }

        // Initialize WebSocket for real-time progress now that ComfyUI is awake
        import('./api.js').then(({ initWebSocket }) => initWebSocket());

        // 2. Build workflow
        setVideoStatus('⚙️ Building AnimateDiff workflow…', 'active');
        const workflowData = await buildAnimateDiffWorkflow(prompt, negPrompt, {
            modelName: selectedVideoModel.name,
            frameCount, fps, width, height,
            steps: ANIMATEDIFF_DEFAULTS.steps,
            cfg: ANIMATEDIFF_DEFAULTS.cfg
        });

        // 3. Submit to ComfyUI
        setVideoStatus('🎬 Submitting to ComfyUI…', 'active');
        const res = await fetch(`http://${COMFY_API_LIVE}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflowData, client_id: CLIENT_ID }),
            signal
        });
        if (!res.ok) throw new Error(`ComfyUI error (${res.status}): ${await res.text()}`);
        const data = await res.json();
        saveTabState('tab3', { activePromptId: data.prompt_id });

        // 4. Poll for result (VHS outputs a gif, so filename ends in .gif)
        setVideoStatus('⏳ Generating frames… this may take a minute…', 'active');
        const filename = await pollHistory(data.prompt_id, signal);

        // 5. Display result
        const gifUrl = `http://${COMFY_API_LIVE}/view?filename=${filename}&type=output&t=${Date.now()}`;
        const resultImg = document.getElementById('videoResult');
        resultImg.src = gifUrl;
        resultImg.style.display = 'block';

        // Enable download
        const dlBtn = document.getElementById('btnDownloadVideo');
        if (dlBtn) {
            dlBtn.style.display = 'inline-flex';
            dlBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = gifUrl;
                a.download = `animatediff_${Date.now()}.gif`;
                a.click();
            };
        }

        setVideoStatus('✨ Animation complete!', 'success');
        saveTabState('tab3', { activePromptId: null });

    } catch (err) {
        if (err.name === 'AbortError' || _videoCancelFlag) {
            setVideoStatus('⛔ Cancelled.', 'error');
        } else {
            setVideoStatus(`❌ ${err.message}`, 'error');
            console.error('[video_engine] startVideoGen error:', err);
        }
        saveTabState('tab3', { activePromptId: null });
    } finally {
        showVideoProgress(false);
        btn.disabled = false;
        btn.textContent = '▶ Generate Animation';
        cancelBtn.style.display = 'none';
        setTabActivity('videogen', false);
    }
}

export async function resumeVideoGen(prompt_id) {
    _videoAbortController = new AbortController();
    _videoCancelFlag = false;
    const signal = _videoAbortController.signal;

    const btn = document.getElementById('btnStartVideo');
    const cancelBtn = document.getElementById('btnCancelVideo');
    btn.disabled = true;
    btn.textContent = '⏳ Reconnecting…';
    cancelBtn.style.display = 'block';
    cancelBtn.disabled = false;

    setVideoStatus('🚦 Reconnecting to active generation…', 'active');
    showVideoProgress(true);
    setTabActivity('videogen', true);

    try {
        import('./api.js').then(({ initWebSocket }) => initWebSocket());

        setVideoStatus('⏳ Generating frames… this may take a minute…', 'active');
        const filename = await pollHistory(prompt_id, signal);

        const gifUrl = `http://${COMFY_API_LIVE}/view?filename=${filename}&type=output&t=${Date.now()}`;
        const resultImg = document.getElementById('videoResult');
        resultImg.src = gifUrl;
        resultImg.style.display = 'block';

        const dlBtn = document.getElementById('btnDownloadVideo'); // Need definition?
        if (dlBtn) {
            dlBtn.style.display = 'inline-flex';
            dlBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = gifUrl;
                a.download = `animatediff_${Date.now()}.gif`;
                a.click();
            };
        }

        setVideoStatus('✨ Animation complete!', 'success');
        saveTabState('tab3', { activePromptId: null });

    } catch (err) {
        if (err.name === 'AbortError' || _videoCancelFlag) {
            setVideoStatus('⛔ Reconnect cancelled.', 'error');
        } else {
            setVideoStatus(`❌ ${err.message}`, 'error');
            console.error('[video_engine] resumeVideoGen error:', err);
        }
        saveTabState('tab3', { activePromptId: null });
    } finally {
        showVideoProgress(false);
        btn.disabled = false;
        btn.textContent = '✦ Start Sequential Generation';
        cancelBtn.style.display = 'none';
        setTabActivity('videogen', false);
    }
}
