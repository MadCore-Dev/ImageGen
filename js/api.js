// ============================================================
//  COMFYUI CONNECTION STATUS & WEBSOCKET
// ============================================================
async function checkComfyStatus() {
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

function initWebSocket() {
    if (socket && socket.readyState === WebSocket.OPEN) return;
    if (wsRetries >= WS_MAX_RETRIES) {
        console.warn('WebSocket max retries reached. WS progress updates disabled.');
        return;
    }

    socket = new WebSocket(`ws://${COMFY_API_LIVE}/ws?clientId=${CLIENT_ID}`);

    socket.onopen = () => { wsRetries = 0; };

    socket.onmessage = (event) => {
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

    socket.onclose = () => {
        const wasMidGeneration = document.getElementById('btnStartAnim')?.disabled ||
            document.getElementById('generateBtn')?.disabled;
        socket = null;
        wsRetries++;
        if (wasMidGeneration) {
            setSpriteStatus('⚠️ ComfyUI disconnected during generation — possible OOM crash. Check Traffic Cop, then retry.', 'error');
            setStatus('⚠️ ComfyUI disconnected mid-generation. Possible out-of-memory crash.', 'error');
        }
        if (wsRetries < WS_MAX_RETRIES) {
            const delay = Math.min(2000 * wsRetries, 10000);
            setTimeout(initWebSocket, delay);
        }
    };
}

// ============================================================
//  IMAGE UPLOAD & LONG-POLLING
// ============================================================
async function uploadImageToComfy(blob, filename) {
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

async function pollHistory(prompt_id) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(async () => {
            try {
                attempts++;
                const res = await fetch(`http://${COMFY_API_LIVE}/history/${prompt_id}`);
                const data = await res.json();

                if (data[prompt_id]) {
                    clearInterval(interval);
                    const outputs = data[prompt_id].outputs;
                    let filename = null;
                    for (const nodeId in outputs) {
                        if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
                            filename = outputs[nodeId].images[0].filename;
                            break;
                        }
                    }
                    if (filename) resolve(filename);
                    else reject(new Error('No images found in workflow output'));
                } else if (data.error || attempts > 600) {
                    // Also trap endless loops if the node failed but history didn't populate an image.
                    clearInterval(interval);
                    reject(new Error(data.error || 'Timeout polling history. Check ComfyUI terminal for node errors.'));
                }
            } catch (err) {
                clearInterval(interval);
                reject(err);
            }
        }, 1000);
    });
}
