#!/usr/bin/env node
/**
 * Canva OAuth Helper Server for TractionJackson
 *
 * FIXED: PKCE values are now generated server-side and never exposed to the browser.
 * This is required by Canva's security policy.
 *
 * Usage:
 *   node canva-oauth-server.js
 *
 * Then click "Connect to Canva" in TractionJackson.
 */

const http = require('http');
const https = require('https');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.CANVA_OAUTH_PORT || process.env.OAUTH_PORT || 3333;
const CANVA_AUTH_URL = 'https://www.canva.com/api/oauth/authorize'; // Authorize uses www.canva.com, token uses api.canva.com
const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';

// CANVA_REDIRECT_URI takes priority (must match exactly what's registered in Canva Developer Portal)
// Falls back to constructing from PUBLIC_BASE_URL
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://127.0.0.1`;
const REDIRECT_URI = process.env.CANVA_REDIRECT_URI || `${PUBLIC_BASE_URL}:${PORT}/callback`;

// Read credentials from environment variables (set these before running)
const DEFAULT_CLIENT_ID = process.env.CANVA_CLIENT_ID || '';
const DEFAULT_CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET || '';

// Main server URL for token forwarding
const TJ_SERVER_URL = process.env.TJ_SERVER_URL || `http://127.0.0.1:${process.env.TJ_PORT || 3000}`;
const SCOPES = [
  'design:content:read',
  'design:meta:read',
  'design:content:write',
  'asset:read',
  'asset:write',
  'folder:read',
  'folder:write',
  'brandtemplate:meta:read',    // Required for listing Brand Templates
  'brandtemplate:content:read'  // Required for reading template datasets
];

// Store PKCE verifiers by state - NEVER expose to browser
const pkceStore = new Map();

// Store client credentials by state (temporary, for the OAuth flow)
const credentialStore = new Map();

/**
 * Generate a cryptographically secure random string for PKCE
 */
function generateCodeVerifier() {
    // 43-128 characters, using URL-safe base64
    return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate code challenge from code verifier using SHA-256
 */
function generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Generate a random state parameter
 */
function generateState() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Exchange authorization code for access token
 */
function exchangeCodeForToken(code, codeVerifier, clientId, clientSecret) {
    return new Promise((resolve, reject) => {
        const data = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            code_verifier: codeVerifier
        }).toString();

        console.log('');
        console.log('=== TOKEN EXCHANGE ===');
        console.log('Exchanging authorization code for access token...');
        console.log('Code verifier length:', codeVerifier.length);
        console.log('======================');
        console.log('');

        // Basic auth header with client_id:client_secret
        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(data),
                'Authorization': `Basic ${authHeader}`
            }
        };

        const req = https.request(CANVA_TOKEN_URL, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    if (res.statusCode === 200) {
                        console.log('✓ Token exchange successful!');
                        resolve(result);
                    } else {
                        console.log('✗ Token exchange failed:', result);
                        reject(new Error(result.error_description || result.error || 'Token exchange failed'));
                    }
                } catch (e) {
                    console.log('✗ Failed to parse response:', body);
                    reject(new Error('Failed to parse token response'));
                }
            });
        });

        req.on('error', (e) => {
            console.log('✗ Request error:', e.message);
            reject(e);
        });
        req.write(data);
        req.end();
    });
}

/**
 * Save tokens directly to token store (shared with main server)
 * This avoids needing to call the main server's API endpoint
 */
const fs = require('fs');
const path = require('path');
const TOKEN_STORE_PATH = process.env.TJ_DATA_DIR
  ? path.join(process.env.TJ_DATA_DIR, 'tokens.json')
  : path.join(__dirname, 'data', 'tokens.json');

function saveTokensToStore(accessToken, refreshToken, expiresIn) {
    try {
        // Ensure directory exists
        const dir = path.dirname(TOKEN_STORE_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const expiresAt = Date.now() + (expiresIn * 1000);
        const tokens = {
            canva: {
                access_token: accessToken,
                refresh_token: refreshToken || null,
                expires_at: expiresAt,
                updated_at: new Date().toISOString()
            }
        };

        fs.writeFileSync(TOKEN_STORE_PATH, JSON.stringify(tokens, null, 2));
        console.log('✓ Tokens saved to store:', TOKEN_STORE_PATH);
        console.log(`  Expires at: ${new Date(expiresAt).toISOString()}`);
        return true;
    } catch (error) {
        console.error('✗ Failed to save tokens:', error.message);
        return false;
    }
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Health check
    if (parsedUrl.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'Canva OAuth server is running' }));
        return;
    }

    // ========================================
    // CONNECT - Direct redirect to Canva OAuth (simpler UX)
    // ========================================
    if (parsedUrl.pathname === '/connect') {
        const client_id = DEFAULT_CLIENT_ID;
        const client_secret = DEFAULT_CLIENT_SECRET;

        if (!client_id || !client_secret) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Credentials Required</title>
                    <style>
                        body { font-family: -apple-system, sans-serif; background: #1a1a2e; color: #fff;
                               display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                        .container { background: #16213e; padding: 40px; border-radius: 12px; text-align: center; max-width: 500px; }
                        h1 { color: #e94560; }
                        code { background: #1a1a2e; padding: 4px 8px; border-radius: 4px; display: block; margin: 10px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Missing Canva Credentials</h1>
                        <p>Please set environment variables before starting the OAuth server:</p>
                        <code>export CANVA_CLIENT_ID=your_client_id</code>
                        <code>export CANVA_CLIENT_SECRET=your_client_secret</code>
                        <p>Then restart the OAuth server.</p>
                    </div>
                </body>
                </html>
            `);
            return;
        }

        // Generate PKCE values
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);
        const state = generateState();

        // Store the verifier and credentials
        pkceStore.set(state, codeVerifier);
        credentialStore.set(state, { clientId: client_id, clientSecret: client_secret });

        // Clean up after 10 minutes
        setTimeout(() => {
            pkceStore.delete(state);
            credentialStore.delete(state);
        }, 10 * 60 * 1000);

        // Build authorization URL
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: client_id,
            redirect_uri: REDIRECT_URI,
            scope: SCOPES.join(' '),
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
        });

        const authUrl = `${CANVA_AUTH_URL}?${params}`;

        console.log('');
        console.log('=== CONNECT - REDIRECTING TO CANVA ===');
        console.log('State:', state);
        console.log('=====================================');
        console.log('');

        // Redirect to Canva
        res.writeHead(302, { Location: authUrl });
        res.end();
        return;
    }

    // ========================================
    // START OAUTH - Generate auth URL server-side
    // ========================================
    if (parsedUrl.pathname === '/start-oauth') {
        // Use query params or fall back to environment variables
        const client_id = parsedUrl.query.client_id || DEFAULT_CLIENT_ID;
        const client_secret = parsedUrl.query.client_secret || DEFAULT_CLIENT_SECRET;

        if (!client_id || !client_secret) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Missing credentials',
                message: 'Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET environment variables, or pass client_id and client_secret as query params'
            }));
            return;
        }

        // Generate PKCE values (server-side only - never sent to browser)
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);
        const state = generateState();

        // Store the verifier and credentials (keyed by state)
        pkceStore.set(state, codeVerifier);
        credentialStore.set(state, { clientId: client_id, clientSecret: client_secret });

        // Clean up after 10 minutes
        setTimeout(() => {
            pkceStore.delete(state);
            credentialStore.delete(state);
        }, 10 * 60 * 1000);

        // Build authorization URL
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: client_id,
            redirect_uri: REDIRECT_URI,
            scope: SCOPES.join(' '),
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
        });

        const authUrl = `${CANVA_AUTH_URL}?${params}`;

        console.log('');
        console.log('=== NEW OAUTH FLOW STARTED ===');
        console.log('State:', state);
        console.log('Code challenge generated (verifier stored securely)');
        console.log('==============================');
        console.log('');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ authUrl, state }));
        return;
    }

    // ========================================
    // OAUTH CALLBACK - Handle Canva redirect
    // ========================================
    if (parsedUrl.pathname === '/callback') {
        const { code, state, error, error_description } = parsedUrl.query;

        if (error) {
            console.log('OAuth error:', error, error_description);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Canva Authorization Failed</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                               background: #1a1a2e; color: #fff; display: flex; justify-content: center;
                               align-items: center; min-height: 100vh; margin: 0; }
                        .container { background: #16213e; padding: 40px; border-radius: 12px; text-align: center; max-width: 500px; }
                        h1 { color: #e94560; margin-bottom: 20px; }
                        .error { background: #2d1f2f; padding: 15px; border-radius: 8px; margin-top: 20px; color: #e94560; }
                    </style>
                    <script>
                        if (window.opener) {
                            window.opener.postMessage({ type: 'canva_oauth_error', error: '${error_description || error}' }, '*');
                        }
                    </script>
                </head>
                <body>
                    <div class="container">
                        <h1>❌ Authorization Failed</h1>
                        <p>Canva authorization was not completed.</p>
                        <div class="error">${error_description || error}</div>
                        <p style="margin-top: 20px;">You can close this window and try again.</p>
                    </div>
                </body>
                </html>
            `);
            return;
        }

        if (!code || !state) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head><title>Error</title>
                <style>
                    body { font-family: -apple-system, sans-serif; background: #1a1a2e; color: #fff;
                           display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    .container { background: #16213e; padding: 40px; border-radius: 12px; text-align: center; }
                    h1 { color: #e94560; }
                </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Missing Parameters</h1>
                        <p>No authorization code or state was provided.</p>
                    </div>
                </body>
                </html>
            `);
            return;
        }

        // Retrieve stored PKCE verifier and credentials
        const codeVerifier = pkceStore.get(state);
        const credentials = credentialStore.get(state);

        if (!codeVerifier || !credentials) {
            console.log('State not found or expired:', state);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Session Expired</title>
                    <style>
                        body { font-family: -apple-system, sans-serif; background: #1a1a2e; color: #fff;
                               display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                        .container { background: #16213e; padding: 40px; border-radius: 12px; text-align: center; max-width: 500px; }
                        h1 { color: #e94560; }
                    </style>
                    <script>
                        if (window.opener) {
                            window.opener.postMessage({ type: 'canva_oauth_error', error: 'Session expired. Please try again.' }, '*');
                        }
                    </script>
                </head>
                <body>
                    <div class="container">
                        <h1>❌ Session Expired</h1>
                        <p>The OAuth session has expired or was not found.</p>
                        <p>Please close this window and try connecting again.</p>
                    </div>
                </body>
                </html>
            `);
            return;
        }

        // Clean up stored values (single use)
        pkceStore.delete(state);
        credentialStore.delete(state);

        // Exchange code for token
        try {
            const tokenData = await exchangeCodeForToken(code, codeVerifier, credentials.clientId, credentials.clientSecret);

            // AUTO-SAVE: Persist tokens to shared token store
            const saved = saveTokensToStore(
                tokenData.access_token,
                tokenData.refresh_token,
                tokenData.expires_in || 14400
            );

            const expiresHours = Math.round((tokenData.expires_in || 14400) / 3600);
            const hasRefresh = !!tokenData.refresh_token;
            const mainAppUrl = `${PUBLIC_BASE_URL}:${process.env.TJ_PORT || 3000}`;

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Canva Connected!</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                               background: #1a1a2e; color: #fff; display: flex; justify-content: center;
                               align-items: center; min-height: 100vh; margin: 0; }
                        .container { background: #16213e; padding: 40px; border-radius: 12px; text-align: center; max-width: 500px; }
                        h1 { color: #4ade80; margin-bottom: 20px; }
                        .success-icon { font-size: 64px; margin-bottom: 20px; }
                        .info { color: #a0a0a0; font-size: 14px; margin-top: 20px; }
                        .details { background: #1a1a2e; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left; }
                        .details p { margin: 8px 0; }
                        .check { color: #4ade80; }
                        .warn { color: #fbbf24; }
                        a { color: #60a5fa; }
                        button { background: #4ade80; color: #000; border: none; padding: 12px 24px;
                                 border-radius: 6px; cursor: pointer; font-weight: bold; margin: 10px 5px;
                                 text-decoration: none; display: inline-block; }
                        button:hover { background: #22c55e; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="success-icon">✓</div>
                        <h1>Canva Connected!</h1>
                        <p>Your Canva account is now linked to TractionJackson.</p>

                        <div class="details">
                            <p><span class="check">✓</span> Access token obtained</p>
                            <p><span class="${hasRefresh ? 'check' : 'warn'}">${hasRefresh ? '✓' : '⚠'}</span> Refresh token: ${hasRefresh ? 'Yes (auto-refresh enabled)' : 'No'}</p>
                            <p><span class="check">✓</span> Token expires in: ${expiresHours} hours</p>
                            <p><span class="${saved ? 'check' : 'warn'}">${saved ? '✓' : '✗'}</span> Saved to server: ${saved ? 'Yes' : 'Failed'}</p>
                        </div>

                        ${saved ? `
                            <p class="info">
                                <strong>Next step:</strong> Restart TractionJackson to load the new token.<br>
                                Run: <code>/opt/tj-restart.sh</code>
                            </p>
                            <a href="${mainAppUrl}" target="_blank">
                                <button>Open TractionJackson</button>
                            </a>
                        ` : `
                            <p class="info" style="color: #ef4444;">
                                Token save failed. Check server logs.
                            </p>
                        `}

                        <p class="info" style="margin-top: 30px;">
                            You can close this window.
                        </p>
                    </div>
                </body>
                </html>
            `);

        } catch (error) {
            console.log('Token exchange error:', error.message);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Token Exchange Failed</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                               background: #1a1a2e; color: #fff; display: flex; justify-content: center;
                               align-items: center; min-height: 100vh; margin: 0; }
                        .container { background: #16213e; padding: 40px; border-radius: 12px; text-align: center; max-width: 500px; }
                        h1 { color: #e94560; margin-bottom: 20px; }
                        .error { background: #2d1f2f; padding: 15px; border-radius: 8px; margin: 20px 0; color: #e94560; }
                    </style>
                    <script>
                        if (window.opener) {
                            window.opener.postMessage({ type: 'canva_oauth_error', error: '${error.message.replace(/'/g, "\\'")}' }, '*');
                        }
                    </script>
                </head>
                <body>
                    <div class="container">
                        <h1>❌ Token Exchange Failed</h1>
                        <div class="error">${error.message}</div>
                        <p>Please check your Client ID and Client Secret are correct.</p>
                        <p>You can close this window and try again.</p>
                    </div>
                </body>
                </html>
            `);
        }
        return;
    }

    // Default landing page
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Canva OAuth Server</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                       background: #1a1a2e; color: #fff; display: flex; justify-content: center;
                       align-items: center; min-height: 100vh; margin: 0; }
                .container { background: #16213e; padding: 40px; border-radius: 12px; text-align: center; }
                h1 { color: #4ade80; }
                code { background: #1a1a2e; padding: 4px 8px; border-radius: 4px; }
                .status { color: #4ade80; font-size: 18px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎨 Canva OAuth Server</h1>
                <p class="status">✓ Server is running</p>
                <p>Port: <code>${PORT}</code></p>
                <p>Click "Connect to Canva" in TractionJackson to start authorization.</p>
            </div>
        </body>
        </html>
    `);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🎨 Canva OAuth Server (PKCE-Secure)');
    console.log('====================================');
    console.log(`Listening on port: ${PORT}`);
    console.log(`Public URL: ${PUBLIC_BASE_URL}:${PORT}`);
    console.log(`Redirect URI: ${REDIRECT_URI}`);
    console.log('');
    console.log('To connect Canva, visit:');
    console.log(`  ${PUBLIC_BASE_URL}:${PORT}/connect`);
    console.log('');
});
