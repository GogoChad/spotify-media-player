// ═══════════════════════════════════════════════════════════════
// SPOTIFY PLUGIN FOR PENGU LOADER (v2 — with auto auth)
// Requires: server.js running in background (node server.js)
// ═══════════════════════════════════════════════════════════════

const AUTH_SERVER = 'http://localhost:8888';

// ─────────────────────────────────────────────────────────────
// TOKEN — fetched from local auth server
// ─────────────────────────────────────────────────────────────
let cachedToken = null;

async function getToken() {
    try {
        const res = await fetch(`${AUTH_SERVER}/token`);
        if (!res.ok) return null;
        const data = await res.json();
        cachedToken = data.access_token || null;
        return cachedToken;
    } catch {
        return cachedToken; // fallback to cached if server unreachable
    }
}

// ─────────────────────────────────────────────────────────────
// SPOTIFY API WRAPPER
// ─────────────────────────────────────────────────────────────
async function spReq(endpoint, method = 'GET', body = null) {
    const token = await getToken();
    if (!token) return null;

    const opts = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    if (body) opts.body = JSON.stringify(body);

    try {
        const res = await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, opts);
        if (res.status === 204 || method !== 'GET') return res;
        if (res.status === 401) { cachedToken = null; return null; }
        return await res.json();
    } catch (e) {
        console.error('[Spotify] Request failed:', e);
        return null;
    }
}

async function setVolume(pct) {
    return spReq(`volume?volume_percent=${Math.round(pct)}`, 'PUT');
}

// ─────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────
function createSpotifyPlugin() {
    if (document.getElementById('sp-root')) return;

    const style = document.createElement('style');
    style.textContent = `
        #sp-root * { box-sizing: border-box; margin: 0; padding: 0; }

        #sp-toggle {
            position: fixed; left: 0; top: 42%;
            width: 28px; height: 52px;
            background: rgba(1, 10, 19, 0.92);
            border: 1px solid #785a28; border-left: none;
            color: #1DB954; display: flex; align-items: center;
            justify-content: center; cursor: pointer; z-index: 10002;
            border-radius: 0 4px 4px 0;
            transition: left 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            font-size: 15px; user-select: none;
        }
        #sp-toggle:hover { background: rgba(24, 26, 32, 0.98); color: #1ed760; }

        #sp-panel {
            position: fixed; left: -295px; top: 0;
            width: 275px; height: 100%;
            background: linear-gradient(160deg, #010a13 0%, #091420 100%);
            border-right: 1px solid #785a28;
            z-index: 10001;
            transition: left 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            padding: 70px 18px 20px;
            display: flex; flex-direction: column; gap: 18px;
            font-family: 'BeaufortforLOL', 'Georgia', serif;
            overflow-y: auto;
        }

        .sp-label {
            color: #a09b8c; font-size: 9px; font-weight: bold;
            letter-spacing: 2px; text-transform: uppercase;
            border-bottom: 1px solid #1a1a24; padding-bottom: 6px;
        }

        #sp-status-bar {
            display: flex; align-items: center; gap: 8px;
            font-size: 10px; color: #5b5a56;
        }
        #sp-status-dot {
            width: 7px; height: 7px; border-radius: 50%;
            background: #3c3c41; flex-shrink: 0;
            transition: background 0.3s;
        }
        #sp-status-dot.connected { background: #1DB954; box-shadow: 0 0 6px #1DB95466; }
        #sp-status-dot.error { background: #c8302b; }

        #sp-login-btn {
            width: 100%; padding: 10px; background: #1DB954;
            border: none; border-radius: 3px; color: #000;
            font-family: inherit; font-size: 11px; font-weight: bold;
            letter-spacing: 1.5px; text-transform: uppercase;
            cursor: pointer; transition: background 0.15s;
        }
        #sp-login-btn:hover { background: #1ed760; }
        #sp-login-btn.hidden { display: none; }

        #sp-art {
            width: 100%; aspect-ratio: 1;
            border-radius: 3px; background: #0a1428;
            object-fit: cover; border: 1px solid #1a2535;
        }
        #sp-track {
            color: #f0e6d2; font-size: 13px;
            white-space: nowrap; overflow: hidden;
            text-overflow: ellipsis; text-align: center;
        }
        #sp-artist { color: #c89b3c; font-size: 11px; text-align: center; }

        #sp-progress-wrap {
            width: 100%; height: 3px; background: #1a2535;
            border-radius: 2px; cursor: pointer; position: relative;
        }
        #sp-progress-fill {
            height: 100%; background: #1DB954; border-radius: 2px;
            width: 0%; transition: width 0.8s linear; pointer-events: none;
        }
        #sp-times {
            display: flex; justify-content: space-between;
            color: #5b5a56; font-size: 9px;
        }

        #sp-controls {
            display: flex; justify-content: center;
            align-items: center; gap: 20px;
        }
        .sp-btn {
            background: none; border: none; cursor: pointer;
            color: #c89b3c; font-size: 18px; padding: 4px;
            transition: color 0.15s, transform 0.1s; line-height: 1;
        }
        .sp-btn:hover { color: #f0e6d2; transform: scale(1.12); }
        .sp-btn:active { transform: scale(0.92); }
        #sp-playpause { color: #f0e6d2; font-size: 28px; }
        #sp-playpause:hover { color: #1DB954; }

        #sp-extras { display: flex; justify-content: center; gap: 16px; }
        .sp-extra-btn {
            background: none; border: 1px solid #1a2535; cursor: pointer;
            color: #5b5a56; font-size: 10px; letter-spacing: 1px;
            padding: 4px 8px; border-radius: 2px;
            transition: all 0.15s; font-family: inherit;
        }
        .sp-extra-btn:hover { color: #c89b3c; border-color: #785a28; }
        .sp-extra-btn.active { color: #1DB954; border-color: #1DB954; }

        #sp-vol-wrap { display: flex; align-items: center; gap: 10px; }
        #sp-vol-icon { color: #785a28; font-size: 14px; min-width: 16px; text-align: center; }
        #sp-volume {
            flex: 1; -webkit-appearance: none; height: 3px;
            background: #1a2535; border-radius: 2px;
            cursor: pointer; outline: none;
        }
        #sp-volume::-webkit-slider-thumb {
            -webkit-appearance: none; width: 12px; height: 12px;
            background: #c89b3c; border-radius: 50%; cursor: pointer;
        }

        #sp-panel::-webkit-scrollbar { width: 4px; }
        #sp-panel::-webkit-scrollbar-track { background: transparent; }
        #sp-panel::-webkit-scrollbar-thumb { background: #3c3c41; border-radius: 2px; }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'sp-root';

    const toggle = document.createElement('div');
    toggle.id = 'sp-toggle';
    toggle.textContent = '🎵';

    const panel = document.createElement('div');
    panel.id = 'sp-panel';
    panel.innerHTML = `
        <div class="sp-label">Status</div>
        <div id="sp-status-bar">
            <div id="sp-status-dot"></div>
            <span id="sp-status-text">Connecting to auth server...</span>
        </div>
        <button id="sp-login-btn" class="hidden">▸ LOGIN WITH SPOTIFY</button>

        <div class="sp-label">Now Playing</div>
        <img id="sp-art" src="" alt="album art">
        <div>
            <div id="sp-track">Not playing</div>
            <div id="sp-artist">—</div>
        </div>
        <div>
            <div id="sp-progress-wrap"><div id="sp-progress-fill"></div></div>
            <div id="sp-times"><span id="sp-cur">0:00</span><span id="sp-dur">0:00</span></div>
        </div>
        <div id="sp-controls">
            <button class="sp-btn" id="sp-prev" title="Previous">&#9664;&#9664;</button>
            <button class="sp-btn" id="sp-playpause" title="Play/Pause">&#9654;</button>
            <button class="sp-btn" id="sp-next" title="Next">&#9654;&#9654;</button>
        </div>
        <div id="sp-extras">
            <button class="sp-extra-btn" id="sp-shuffle">⇌ SHUFFLE</button>
            <button class="sp-extra-btn" id="sp-repeat">↺ REPEAT</button>
        </div>
        <div class="sp-label">Volume</div>
        <div id="sp-vol-wrap">
            <span id="sp-vol-icon">🔈</span>
            <input type="range" id="sp-volume" min="0" max="100" value="50">
        </div>
    `;

    root.appendChild(toggle);
    root.appendChild(panel);
    document.body.appendChild(root);

    // ── Toggle ────────────────────────────────────────────────
    let isOpen = false;
    toggle.onclick = () => {
        isOpen = !isOpen;
        panel.style.left = isOpen ? '0' : '-295px';
        toggle.style.left = isOpen ? '275px' : '0';
        toggle.textContent = isOpen ? '❮' : '🎵';
    };

    // ── Login button ──────────────────────────────────────────
    panel.querySelector('#sp-login-btn').onclick = () => {
        window.open(`${AUTH_SERVER}/login`, '_blank');
    };

    // ── Controls ──────────────────────────────────────────────
    panel.querySelector('#sp-prev').onclick = () => spReq('previous', 'POST');
    panel.querySelector('#sp-next').onclick = () => spReq('next', 'POST');

    const playBtn = panel.querySelector('#sp-playpause');
    let isPlaying = false;
    playBtn.onclick = async () => {
        isPlaying = !isPlaying;
        await spReq(isPlaying ? 'play' : 'pause', 'PUT');
        playBtn.innerHTML = isPlaying ? '&#9646;&#9646;' : '&#9654;';
    };

    let shuffle = false;
    panel.querySelector('#sp-shuffle').onclick = async function() {
        shuffle = !shuffle;
        await spReq(`shuffle?state=${shuffle}`, 'PUT');
        this.classList.toggle('active', shuffle);
    };

    const repeatModes  = ['off', 'context', 'track'];
    const repeatLabels = ['↺ REPEAT', '↺ ALL', '↺ ONE'];
    let repeatIdx = 0;
    panel.querySelector('#sp-repeat').onclick = async function() {
        repeatIdx = (repeatIdx + 1) % 3;
        await spReq(`repeat?state=${repeatModes[repeatIdx]}`, 'PUT');
        this.textContent = repeatLabels[repeatIdx];
        this.classList.toggle('active', repeatIdx > 0);
    };

    const volSlider = panel.querySelector('#sp-volume');
    const volIcon   = panel.querySelector('#sp-vol-icon');
    let volTimeout;
    volSlider.oninput = () => {
        const v = parseInt(volSlider.value);
        volIcon.textContent = v === 0 ? '🔇' : v < 50 ? '🔉' : '🔊';
        clearTimeout(volTimeout);
        volTimeout = setTimeout(() => setVolume(v), 300);
    };

    let currentDuration = 0;
    panel.querySelector('#sp-progress-wrap').onclick = async function(e) {
        if (!currentDuration) return;
        const posMs = Math.round((e.offsetX / this.offsetWidth) * currentDuration);
        await spReq(`seek?position_ms=${posMs}`, 'PUT');
    };

    // ── Helpers ───────────────────────────────────────────────
    function fmtTime(ms) {
        const s = Math.floor(ms / 1000);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }

    function setStatus(connected, text) {
        const dot  = panel.querySelector('#sp-status-dot');
        const span = panel.querySelector('#sp-status-text');
        const btn  = panel.querySelector('#sp-login-btn');
        dot.className  = connected ? 'connected' : (text.includes('error') ? 'error' : '');
        span.textContent = text;
        btn.classList.toggle('hidden', connected);
    }

    // ── Polling ───────────────────────────────────────────────
    async function poll() {
        // Check server status first
        try {
            const statusRes = await fetch(`${AUTH_SERVER}/status`);
            const status = await statusRes.json();
            if (!status.logged_in) {
                setStatus(false, 'Not logged in — click below');
                return;
            }
            setStatus(true, 'Connected');
        } catch {
            setStatus(false, 'Auth server offline — run server.js');
            return;
        }

        if (!isOpen) return;

        const data = await spReq('currently-playing');
        if (!data || !data.item) {
            panel.querySelector('#sp-track').textContent = 'No active device';
            panel.querySelector('#sp-artist').textContent = '—';
            panel.querySelector('#sp-progress-fill').style.width = '0%';
            return;
        }

        const { item, is_playing, progress_ms, shuffle_state, repeat_state } = data;

        panel.querySelector('#sp-track').textContent = item.name;
        panel.querySelector('#sp-artist').textContent = item.artists.map(a => a.name).join(', ');

        const artUrl = item.album?.images?.[1]?.url || item.album?.images?.[0]?.url || '';
        const artEl = panel.querySelector('#sp-art');
        if (artEl.src !== artUrl) artEl.src = artUrl;

        currentDuration = item.duration_ms;
        const pct = (progress_ms / currentDuration) * 100;
        panel.querySelector('#sp-progress-fill').style.width = `${pct}%`;
        panel.querySelector('#sp-cur').textContent = fmtTime(progress_ms);
        panel.querySelector('#sp-dur').textContent = fmtTime(currentDuration);

        if (isPlaying !== is_playing) {
            isPlaying = is_playing;
            playBtn.innerHTML = isPlaying ? '&#9646;&#9646;' : '&#9654;';
        }

        if (shuffle !== shuffle_state) {
            shuffle = shuffle_state;
            panel.querySelector('#sp-shuffle').classList.toggle('active', shuffle);
        }

        const rIdx = repeatModes.indexOf(repeat_state);
        if (rIdx !== -1 && rIdx !== repeatIdx) {
            repeatIdx = rIdx;
            const btn = panel.querySelector('#sp-repeat');
            btn.textContent = repeatLabels[repeatIdx];
            btn.classList.toggle('active', repeatIdx > 0);
        }
    }

    setInterval(poll, 4000);
    poll();
}

window.addEventListener('load', () => setTimeout(createSpotifyPlugin, 2000));
