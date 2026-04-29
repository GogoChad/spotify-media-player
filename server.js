// ═══════════════════════════════════════════════════════════════
// SPOTIFY AUTH SERVER — Run this in background while playing LoL
// Usage: node server.js
// ═══════════════════════════════════════════════════════════════

const http = require('http');
const https = require('https');
const fs = require('fs');
const url = require('url');
const crypto = require('crypto');
require('dotenv').config();

// ── YOUR SPOTIFY APP CREDENTIALS ────────────────────────────────
// (from https://developer.spotify.com/dashboard)
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
const PORT = 8888;

const SCOPES = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing'
].join(' ');

const TOKEN_FILE = './tokens.json';

// ── Token Storage ────────────────────────────────────────────────
function loadTokens() {
    try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); }
    catch { return null; }
}

function saveTokens(data) {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
}

// ── Refresh Access Token ─────────────────────────────────────────
function refreshAccessToken(refreshToken) {
    return new Promise((resolve, reject) => {
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET
        }).toString();

        const req = https.request({
            hostname: 'accounts.spotify.com',
            path: '/api/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { reject(new Error('Failed to parse token response')); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ── Exchange Code for Tokens ─────────────────────────────────────
function exchangeCode(code) {
    return new Promise((resolve, reject) => {
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET
        }).toString();

        const req = https.request({
            hostname: 'accounts.spotify.com',
            path: '/api/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { reject(new Error('Failed to parse response')); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ── Auto-refresh loop ────────────────────────────────────────────
let currentTokens = loadTokens();

async function autoRefresh() {
    if (!currentTokens?.refresh_token) return;
    try {
        console.log('[Spotify] Refreshing access token...');
        const data = await refreshAccessToken(currentTokens.refresh_token);
        if (data.access_token) {
            currentTokens.access_token = data.access_token;
            if (data.refresh_token) currentTokens.refresh_token = data.refresh_token;
            currentTokens.expires_at = Date.now() + (data.expires_in * 1000);
            saveTokens(currentTokens);
            console.log('[Spotify] Token refreshed successfully.');
        }
    } catch (e) {
        console.error('[Spotify] Refresh failed:', e.message);
    }
}

// Refresh 5 minutes before expiry
setInterval(async () => {
    if (currentTokens?.expires_at && Date.now() > currentTokens.expires_at - 5 * 60 * 1000) {
        await autoRefresh();
    }
}, 30 * 1000); // check every 30s

// ── HTTP Server ──────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);

    // CORS headers — needed so the Pengu plugin can call this server
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204); res.end(); return;
    }

    // ── GET /login → redirect to Spotify ──────────────────────
    if (parsed.pathname === '/login') {
        const state = crypto.randomBytes(8).toString('hex');
        const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: SCOPES,
            redirect_uri: REDIRECT_URI,
            state
        });
        res.writeHead(302, { Location: authUrl });
        res.end();
        return;
    }

    // ── GET /callback → exchange code, save tokens ─────────────
    if (parsed.pathname === '/callback') {
        const code = parsed.query.code;
        if (!code) {
            res.writeHead(400); res.end('Missing code'); return;
        }
        try {
            const data = await exchangeCode(code);
            currentTokens = {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_at: Date.now() + (data.expires_in * 1000)
            };
            saveTokens(currentTokens);
            console.log('[Spotify] Logged in successfully! Tokens saved.');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <html><body style="background:#010a13;color:#1DB954;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px;">
                    <div style="font-size:48px;">✓</div>
                    <div style="font-size:20px;letter-spacing:2px;">LOGGED IN SUCCESSFULLY</div>
                    <div style="color:#785a28;font-size:12px;">You can close this tab and go back to League.</div>
                </body></html>
            `);
        } catch (e) {
            res.writeHead(500); res.end('Auth failed: ' + e.message);
        }
        return;
    }

    // ── GET /token → return current access token to plugin ─────
    if (parsed.pathname === '/token') {
        if (!currentTokens?.access_token) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'not_logged_in' }));
            return;
        }
        // Refresh if expired
        if (Date.now() > currentTokens.expires_at - 60 * 1000) {
            await autoRefresh();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ access_token: currentTokens.access_token }));
        return;
    }

    // ── GET /status ─────────────────────────────────────────────
    if (parsed.pathname === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            logged_in: !!currentTokens?.access_token,
            expires_at: currentTokens?.expires_at || null
        }));
        return;
    }

    res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════╗`);
    console.log(`║   SPOTIFY AUTH SERVER — PORT ${PORT}   ║`);
    console.log(`╚══════════════════════════════════════╝`);
    if (currentTokens?.access_token) {
        console.log('✓ Already logged in, tokens loaded from file.');
    } else {
        console.log('→ Not logged in yet.');
        console.log('→ Open: http://localhost:8888/login to authenticate.');
    }
    console.log('\nKeep this window open while playing LoL.\n');
});
