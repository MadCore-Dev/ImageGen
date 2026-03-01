import {
    COMFY_API_LIVE, CLIENT_ID, socket, wsRetries, WS_MAX_RETRIES,
    setSocket, setWsRetries
} from './config.js';
import { setProgress, setSpriteStatus, setStatus } from './app.js';

// ============================================================
//  COMFYUI CONNECTION STATUS & WEBSOCKET
// ============================================================
export async function checkComfyStatus() {
    const pill = document.getElementById('connPill');
    const label = document.getElementById('connLabel');
    try {
        const res = await fetch(`http://${COMFY_API_LIVE}/system_stats`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
            pill.className = 'conn-pill online';
            label.textContent = 'ComfyUI — Online';
        } else { throw new Error('bad status'); }
    } catch {
        pill.className = 'conn-pill offline';
        label.textContent = 'ComfyUI — Offline';
    }
}

let lastComfyActivity = Date.now();

export function initWebSocket() {
    if (socket && socket.readyState === WebSocket.OPEN) return;
    if (wsRetries >= WS_MAX_RETRIES) {
        console.warn('WebSocket max retries reached. WS progress updates disabled.');
        return;
    }

    const newSocket = new WebSocket(`ws://${COMFY_API_LIVE}/ws?clientId=${CLIENT_ID}`);
    setSocket(newSocket);

    newSocket.onopen = () => { setWsRetries(0); };

    newSocket.onmessage = (event) => {
        try {
            lastComfyActivity = Date.now();
            const data = JSON.parse(event.data);
            const isSpriteTabActive = document.getElementById('tab-spritegen').classList.contains('active');
            const isAnimatingQueue = document.getElementById('btnStartAnim')?.disabled;

            if (data.type === 'progress') {
                const { value, max } = data.data;
                const pc = Math.round((value / max) * 100);
                setProgress(pc);

                if (isSpriteTabActive) {
                    const prefix = isAnimatingQueue ? 'Sequential Queue' : 'Reference Gen';
                    setSpriteStatus(`🎨 ${prefix}: Step ${value}/${max} (${pc}%)`, 'active');
                }
            } else if (data.type === 'executing' && data.data.node) {
                document.getElementById('loaderLabel').textContent = `Running node ${data.data.node}…`;

                if (isSpriteTabActive) {
                    const prefix = isAnimatingQueue ? 'Sequential Queue' : 'Reference Gen';
                    setSpriteStatus(`⚙️ ${prefix}: Running Node ${data.data.node}…`, 'active');
                }
            }
        } catch (_) { }
    };

    newSocket.onclose = () => {
        const wasMidGeneration = document.getElementById('btnStartAnim')?.disabled ||
            document.getElementById('generateBtn')?.disabled;
        setSocket(null);
        let newRetries = wsRetries + 1;
        setWsRetries(newRetries);
        if (wasMidGeneration) {
            setSpriteStatus('⚠️ ComfyUI disconnected during generation — possible OOM crash. Check Traffic Cop, then retry.', 'error');
            setStatus('⚠️ ComfyUI disconnected mid-generation. Possible out-of-memory crash.', 'error');
        }
        if (newRetries < WS_MAX_RETRIES) {
            const delay = Math.min(2000 * newRetries, 10000);
            setTimeout(initWebSocket, delay);
        }
    };
}

// ============================================================
//  IMAGE UPLOAD & LONG-POLLING
// ============================================================
export async function uploadImageToComfy(blob, filename) {
    const formData = new FormData();
    formData.append('image', blob, filename);
    formData.append('type', 'input');
    formData.append('overwrite', 'true');

    const res = await fetch(`http://${COMFY_API_LIVE}/upload/image`, {
        method: 'POST',
        body: formData
    });
    if (!res.ok) throw new Error('Failed to upload reference image to ComfyUI');
    const data = await res.json();
    return data.name;
}

export async function pollHistory(prompt_id, signal = null) {
    lastComfyActivity = Date.now();
    while (true) {
        if (signal?.aborted) throw new DOMException('Generation cancelled by user', 'AbortError');
        if (Date.now() - lastComfyActivity > 30 * 60 * 1000) {
            throw new Error('ComfyUI generation timed out (30 mins).');
        }

        const res = await fetch(`http://${COMFY_API_LIVE}/history/${prompt_id}`);
        const history = await res.json();

        if (history[prompt_id]) {
            const entry = history[prompt_id];
            if (entry?.error) throw new Error(`ComfyUI job failed: ${JSON.stringify(entry.error)}`);
            if (entry?.status?.completed === true && !entry.outputs) {
                throw new Error('ComfyUI job completed with no output.');
            }
            const outputs = entry.outputs;
            if (outputs) {
                const nodeKey = Object.keys(outputs).find(k => outputs[k].images);
                if (nodeKey) return outputs[nodeKey].images[0].filename;
            }
        }
        await new Promise(r => setTimeout(r, 2000));
    }
}
