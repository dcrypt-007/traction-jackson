// server.js - TractionJackson Web UI Server
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const { CampaignManager } = require('./campaign-manager');
const { prepareCampaignPrompts, formatPromptsForDisplay, extractDesignId, CanvaAIQueue } = require('./canva-ai-generator');
const { exportCDNOnly } = require('./canva-export');  // CDN-only export - no server downloads
const { ExportJobManager, createCanvaExporter, JobStatus } = require('./export-jobs');
const { getTokenStore } = require('./token-store');

// Token store for persistent Canva OAuth tokens
const tokenStore = getTokenStore();

// Canva OAuth credentials (from environment)
const CANVA_CLIENT_ID = process.env.CANVA_CLIENT_ID || '';
const CANVA_CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET || '';
const CANVA_OAUTH_PORT = process.env.CANVA_OAUTH_PORT || 3333;

// Security: Admin secret for sensitive endpoints
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ALLOW_MANUAL_TOKEN_IMPORT = process.env.ALLOW_MANUAL_TOKEN_IMPORT === 'true';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';

/**
 * Check if request has valid admin secret
 * Returns true if valid, false otherwise
 * NEVER logs the secret value
 */
function checkAdminAuth(url, res) {
  if (!ADMIN_SECRET) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'ADMIN_SECRET not configured on server' }));
    return false;
  }
  const providedSecret = url.searchParams.get('admin');
  if (providedSecret !== ADMIN_SECRET) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden: invalid or missing admin secret' }));
    return false;
  }
  return true;
}

// Canva AI Queue for tracking designs
const canvaAIQueue = new CanvaAIQueue(path.join(__dirname, 'canva-ai-queue.json'));

// Export Job Manager
const exportJobManager = new ExportJobManager({
  persistPath: path.join(__dirname, 'export-jobs.json'),
  exportTimeout: 120000 // 2 minutes
});

// Create the CDN-only Canva exporter (no server-side downloads)
const canvaExporter = createCanvaExporter(exportCDNOnly);

const PORT = process.env.PORT || 3000;

// State
let campaignManager = null;
let connectedServices = {
  canva: false,
  elevenlabs: false
};

// Initialize services on startup
async function initManager() {
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

  // Check ElevenLabs
  if (elevenLabsKey) {
    connectedServices.elevenlabs = true;
  }

  // Check Canva via token store (supports auto-refresh)
  try {
    const canvaToken = await tokenStore.getValidCanvaToken(CANVA_CLIENT_ID, CANVA_CLIENT_SECRET);
    if (canvaToken) {
      connectedServices.canva = true;
      campaignManager = new CampaignManager({
        outputDir: path.join(__dirname, 'campaigns')
      }).init(canvaToken, elevenLabsKey);
      console.log('[TJ] Canva connected via token store');
    } else {
      // Fallback to env var (for local dev)
      const envToken = process.env.CANVA_ACCESS_TOKEN;
      if (envToken) {
        connectedServices.canva = true;
        campaignManager = new CampaignManager({
          outputDir: path.join(__dirname, 'campaigns')
        }).init(envToken, elevenLabsKey);
        console.log('[TJ] Canva connected via env var (fallback)');
      }
    }
  } catch (error) {
    console.log('[TJ] Canva token refresh failed:', error.message);
    connectedServices.canva = false;
  }
}

/**
 * Get a valid Canva token (from store, with auto-refresh, or env fallback)
 */
async function getCanvaToken() {
  try {
    const token = await tokenStore.getValidCanvaToken(CANVA_CLIENT_ID, CANVA_CLIENT_SECRET);
    if (token) return token;
  } catch (error) {
    console.log('[TJ] Token store failed:', error.message);
  }
  // Fallback to env var
  return process.env.CANVA_ACCESS_TOKEN || null;
}

// HTML Template
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TractionJackson - AI Video Ad Generator</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }

    header {
      text-align: center;
      margin-bottom: 40px;
    }
    .logo {
      font-size: 48px;
      font-weight: 800;
      background: linear-gradient(90deg, #00d4ff, #7c3aed);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    .tagline { color: #94a3b8; font-size: 18px; }

    .status-bar {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 40px;
    }
    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: rgba(255,255,255,0.1);
      border-radius: 30px;
    }
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .status-dot.connected { background: #10b981; }
    .status-dot.disconnected { background: #ef4444; }

    .main-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 40px;
      backdrop-filter: blur(10px);
    }

    h2 {
      font-size: 24px;
      margin-bottom: 30px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    h2 .step {
      background: linear-gradient(90deg, #00d4ff, #7c3aed);
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }

    .form-group {
      margin-bottom: 25px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #94a3b8;
      font-size: 14px;
    }
    input, textarea, select {
      width: 100%;
      padding: 15px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 10px;
      background: rgba(0,0,0,0.3);
      color: #fff;
      font-size: 16px;
      transition: border-color 0.3s;
    }
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: #00d4ff;
    }
    textarea { resize: vertical; min-height: 100px; }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 768px) {
      .grid-2 { grid-template-columns: 1fr; }
    }

    .btn {
      padding: 15px 30px;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }
    .btn-primary {
      background: linear-gradient(90deg, #00d4ff, #7c3aed);
      color: #fff;
      width: 100%;
      margin-top: 20px;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(0, 212, 255, 0.3);
    }
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .variations-list {
      margin-top: 15px;
    }
    .variation-item {
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 15px;
      margin-bottom: 10px;
    }
    .variation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .remove-btn {
      background: none;
      border: none;
      color: #ef4444;
      cursor: pointer;
      font-size: 18px;
    }
    .add-variation-btn {
      background: rgba(255,255,255,0.1);
      border: 1px dashed rgba(255,255,255,0.3);
      border-radius: 10px;
      padding: 15px;
      width: 100%;
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.3s;
    }
    .add-variation-btn:hover {
      background: rgba(255,255,255,0.15);
      color: #fff;
    }

    #output {
      margin-top: 40px;
      padding: 20px;
      background: rgba(0,0,0,0.3);
      border-radius: 10px;
      font-family: monospace;
      white-space: pre-wrap;
      display: none;
    }
    #output.active { display: block; }

    .loading {
      text-align: center;
      padding: 40px;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #00d4ff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
      margin-top: 30px;
    }
    .result-card {
      background: rgba(255,255,255,0.05);
      border-radius: 10px;
      overflow: hidden;
    }
    .result-thumb {
      position: relative;
      background: linear-gradient(135deg, #1a1a2e, #16213e);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 180px;
    }
    .result-thumb video {
      width: 100%;
      max-height: 250px;
      object-fit: contain;
    }
    .result-thumb img {
      width: 100%;
      max-height: 180px;
      object-fit: cover;
    }
    .result-info {
      padding: 15px;
    }
    .result-status {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      margin-bottom: 8px;
    }
    .result-status.success { background: rgba(16, 185, 129, 0.2); color: #10b981; }
    .result-status.failed { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .result-actions {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }
    .result-actions a {
      flex: 1;
      text-align: center;
      padding: 8px 12px;
      background: rgba(255,255,255,0.1);
      border-radius: 6px;
      color: #fff;
      text-decoration: none;
      font-size: 12px;
      transition: background 0.2s;
    }
    .result-actions a:hover {
      background: rgba(255,255,255,0.2);
    }
    .voiceover-player {
      margin-top: 10px;
      width: 100%;
    }
    .voiceover-player audio {
      width: 100%;
      height: 32px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">TractionJackson</div>
      <p class="tagline">AI-Powered Video Ad Creative Generator</p>
    </header>

    <div class="status-bar">
      <div class="status-item">
        <span class="status-dot {{canvaStatus}}"></span>
        <span>Canva</span>
      </div>
      <div class="status-item">
        <span class="status-dot {{elevenLabsStatus}}"></span>
        <span>ElevenLabs</span>
      </div>
    </div>

    <div class="main-card">
      <form id="campaignForm">
        <h2><span class="step">1</span> Campaign Details</h2>

        <div class="grid-2">
          <div class="form-group">
            <label>Campaign Name</label>
            <input type="text" name="campaignName" placeholder="e.g., Product Launch Q1" required>
          </div>
          <div class="form-group">
            <label>Template ID</label>
            <input type="text" name="templateId" placeholder="Canva Brand Template ID" required>
          </div>
        </div>

        <h2><span class="step">2</span> Creative Content</h2>

        <div class="grid-2">
          <div class="form-group">
            <label>Headline</label>
            <input type="text" name="headline" placeholder="Your main message">
          </div>
          <div class="form-group">
            <label>Subheadline</label>
            <input type="text" name="subheadline" placeholder="Supporting text">
          </div>
        </div>

        <div class="form-group">
          <label>Call to Action</label>
          <input type="text" name="cta" placeholder="e.g., Get Started Free">
        </div>

        <div class="form-group">
          <label>Product Image URL (optional)</label>
          <input type="url" name="productImage" placeholder="https://...">
        </div>

        <h2><span class="step">3</span> Voiceover Scripts</h2>

        <div id="variationsContainer" class="variations-list">
          <div class="variation-item">
            <div class="variation-header">
              <strong>Version 1</strong>
            </div>
            <textarea name="script[]" placeholder="Enter voiceover script..."></textarea>
          </div>
        </div>

        <button type="button" class="add-variation-btn" onclick="addVariation()">
          + Add Another Version
        </button>

        <button type="submit" class="btn btn-primary" id="submitBtn">
          🚀 Generate Creatives
        </button>
      </form>

      <div id="output"></div>
      <div id="results"></div>
    </div>
  </div>

  <script>
    let variationCount = 1;

    function addVariation() {
      variationCount++;
      const container = document.getElementById('variationsContainer');
      const div = document.createElement('div');
      div.className = 'variation-item';
      div.innerHTML = \`
        <div class="variation-header">
          <strong>Version \${variationCount}</strong>
          <button type="button" class="remove-btn" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <textarea name="script[]" placeholder="Enter voiceover script..."></textarea>
      \`;
      container.appendChild(div);
    }

    document.getElementById('campaignForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const form = e.target;
      const submitBtn = document.getElementById('submitBtn');
      const output = document.getElementById('output');
      const results = document.getElementById('results');

      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Generating...';
      output.className = 'active';
      output.innerHTML = '<div class="loading"><div class="spinner"></div>Creating your video ads...</div>';
      results.innerHTML = '';

      const formData = new FormData(form);
      const scripts = formData.getAll('script[]').filter(s => s.trim());

      const payload = {
        name: formData.get('campaignName'),
        templateId: formData.get('templateId'),
        creativeData: {
          headline: formData.get('headline'),
          subheadline: formData.get('subheadline'),
          cta: formData.get('cta'),
          product_image: formData.get('productImage')
        },
        voiceoverScripts: scripts.length > 0 ? scripts : null
      };

      try {
        const response = await fetch('/api/campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
          output.innerHTML = '✅ Campaign generated successfully!\\n\\n' +
            'Campaign: ' + result.campaign + '\\n' +
            'Output: ' + result.directory + '\\n\\n' +
            'Summary:\\n' + JSON.stringify(result.summary, null, 2);

          // Show results cards
          if (result.creatives && result.creatives.length > 0) {
            results.innerHTML = '<h3 style="margin: 30px 0 20px">Generated Creatives</h3><div class="results-grid">' +
              result.creatives.map((c, i) => {
                // Determine video source - prefer remote URL, fallback to local
                const videoSrc = c.videoUrl || (c.localVideoPath ? '/campaigns/' + c.localVideoPath.split('/campaigns/')[1] : null);
                const thumbSrc = c.thumbnailUrl || (c.localThumbnailPath ? '/campaigns/' + c.localThumbnailPath.split('/campaigns/')[1] : null);
                const voiceoverSrc = c.voiceover?.filePath ? '/campaigns/' + c.voiceover.filePath.split('/campaigns/')[1] : null;

                return \`
                <div class="result-card">
                  <div class="result-thumb">
                    \${videoSrc
                      ? \`<video controls poster="\${thumbSrc || ''}">
                           <source src="\${videoSrc}" type="video/mp4">
                           Your browser does not support video.
                         </video>\`
                      : thumbSrc
                        ? \`<img src="\${thumbSrc}" alt="Thumbnail">\`
                        : \`<span style="font-size: 48px">\${c.success ? '🎬' : '❌'}</span>\`
                    }
                  </div>
                  <div class="result-info">
                    <span class="result-status \${c.success ? 'success' : 'failed'}">
                      \${c.success ? 'Success' : 'Failed'}
                    </span>
                    <p><strong>Version \${i + 1}</strong></p>
                    \${c.creative ? '<small>Design ID: ' + c.creative.designId.slice(-8) + '</small>' : ''}
                    \${voiceoverSrc ? \`
                      <div class="voiceover-player">
                        <small>Voiceover:</small>
                        <audio controls>
                          <source src="\${voiceoverSrc}" type="audio/mpeg">
                        </audio>
                      </div>
                    \` : ''}
                    <div class="result-actions">
                      \${videoSrc ? \`<a href="\${videoSrc}" download>Download Video</a>\` : ''}
                      \${voiceoverSrc ? \`<a href="\${voiceoverSrc}" download>Download Audio</a>\` : ''}
                    </div>
                  </div>
                </div>
              \`}).join('') + '</div>';
          }
        } else {
          output.innerHTML = '❌ Error: ' + (result.error || 'Unknown error');
        }

      } catch (error) {
        output.innerHTML = '❌ Error: ' + error.message;
      }

      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 Generate Creatives';
    });
  </script>
</body>
</html>`;

// MIME types for static file serving
const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.json': 'application/json'
};

// Serve static files from campaigns directory
function serveStaticFile(req, res, filePath) {
  const campaignsDir = path.join(__dirname, 'campaigns');
  const fullPath = path.join(campaignsDir, filePath);

  // Security: prevent path traversal
  if (!fullPath.startsWith(campaignsDir)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Support range requests for video streaming
    const range = req.headers.range;
    if (range && contentType.startsWith('video/')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });

      fs.createReadStream(fullPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': contentType
      });
      fs.createReadStream(fullPath).pipe(res);
    }
  });
}

// Parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

// API: Run campaign
async function handleCampaignRequest(req, res) {
  try {
    const body = await parseBody(req);

    if (!campaignManager) {
      throw new Error('Campaign manager not initialized. Set CANVA_ACCESS_TOKEN.');
    }

    const campaign = {
      name: body.name || 'Untitled Campaign',
      templateId: body.templateId,
      baseCreativeData: body.creativeData,
      voiceoverScripts: body.voiceoverScripts
    };

    const result = await campaignManager.runCampaign(campaign);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      ...result
    }));

  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
}

// API: List templates
async function handleTemplatesRequest(req, res) {
  try {
    if (!campaignManager) {
      throw new Error('Campaign manager not initialized');
    }

    const templates = await campaignManager.getTemplates();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(templates));

  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

// API: Get template fields
async function handleFieldsRequest(req, res, templateId) {
  try {
    if (!campaignManager) {
      throw new Error('Campaign manager not initialized');
    }

    const fields = await campaignManager.getTemplateFields(templateId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(fields));

  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

// Main request handler
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  console.log(`[TJ Server] ${req.method} ${url.pathname}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Routes
  if (url.pathname === '/' && req.method === 'GET') {
    // Serve the actual index.html file
    const indexPath = path.join(__dirname, 'index.html');
    try {
      const html = fs.readFileSync(indexPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading index.html: ' + e.message);
    }

  } else if (url.pathname === '/api/campaign' && req.method === 'POST') {
    await handleCampaignRequest(req, res);

  } else if (url.pathname === '/api/templates' && req.method === 'GET') {
    await handleTemplatesRequest(req, res);

  } else if (url.pathname.startsWith('/api/templates/') && req.method === 'GET') {
    const templateId = url.pathname.split('/')[3];
    await handleFieldsRequest(req, res, templateId);

  } else if (url.pathname === '/api/status' && req.method === 'GET') {
    // Include token store diagnostics
    const canvaStatus = tokenStore.getCanvaStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      services: connectedServices,
      ready: connectedServices.canva,
      canva: {
        ...canvaStatus,
        hasClientCredentials: !!(CANVA_CLIENT_ID && CANVA_CLIENT_SECRET)
      }
    }));

  } else if (url.pathname === '/api/integrations/status' && req.method === 'GET') {
    // Real health checks for all integrations
    const results = {};

    // 1. Canva check: does token store have a valid token or can refresh work?
    try {
      const canvaToken = await tokenStore.getValidCanvaToken(CANVA_CLIENT_ID, CANVA_CLIENT_SECRET);
      if (canvaToken) {
        results.canva = { connected: true, reason: 'Valid access token' };
      } else {
        results.canva = { connected: false, reason: 'No valid token. Use OAuth to connect.' };
      }
    } catch (err) {
      results.canva = { connected: false, reason: err.message };
    }

    // 2. ElevenLabs check: is API key present AND does GET /v1/user return 200?
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey) {
      results.elevenlabs = { connected: false, reason: 'ELEVENLABS_API_KEY not set in environment' };
    } else {
      try {
        // Make a real API call to verify the key works
        const checkResult = await new Promise((resolve, reject) => {
          const https = require('https');
          const req = https.request({
            hostname: 'api.elevenlabs.io',
            path: '/v1/user',
            method: 'GET',
            headers: { 'xi-api-key': elevenLabsKey },
            timeout: 5000
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              if (res.statusCode === 200) {
                try {
                  const user = JSON.parse(data);
                  resolve({ connected: true, reason: `Authenticated as ${user.first_name || 'user'}` });
                } catch {
                  resolve({ connected: true, reason: 'API key valid (status 200)' });
                }
              } else {
                resolve({ connected: false, reason: `API returned ${res.statusCode}` });
              }
            });
          });
          req.on('error', (err) => resolve({ connected: false, reason: `Connection failed: ${err.message}` }));
          req.on('timeout', () => { req.destroy(); resolve({ connected: false, reason: 'Request timed out (5s)' }); });
          req.end();
        });
        results.elevenlabs = checkResult;
      } catch (err) {
        results.elevenlabs = { connected: false, reason: err.message };
      }
    }

    // 3. ffmpeg check: does `ffmpeg -version` succeed?
    try {
      const { checkFfmpegVersion } = require('./ffmpeg-merge');
      const ffmpegResult = await checkFfmpegVersion();
      results.ffmpeg = {
        available: ffmpegResult.available,
        version: ffmpegResult.version,
        reason: ffmpegResult.available ? `ffmpeg ${ffmpegResult.version}` : 'ffmpeg not found in PATH'
      };
    } catch (err) {
      results.ffmpeg = { available: false, version: null, reason: err.message };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results));

  } else if (url.pathname === '/api/disconnect/canva' && req.method === 'POST') {
    // SECURITY: Requires admin secret
    if (!checkAdminAuth(url, res)) return;

    // Disconnect Canva - clear token store and reset state
    tokenStore.clearCanvaTokens();
    connectedServices.canva = false;
    if (campaignManager) {
      campaignManager.canvaToken = null;
    }
    console.log('[TJ] Canva disconnected (admin action)');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Canva disconnected' }));

  } else if (url.pathname === '/api/canva/connect-url' && req.method === 'GET') {
    // SECURITY: Requires admin secret
    if (!checkAdminAuth(url, res)) return;

    // Return OAuth authorize URL for manual connection
    if (!CANVA_CLIENT_ID) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'CANVA_CLIENT_ID not configured' }));
      return;
    }

    // Use PUBLIC_BASE_URL for remote access, fall back to request host, then localhost
    let baseUrl;
    if (PUBLIC_BASE_URL) {
      baseUrl = PUBLIC_BASE_URL;
    } else {
      // Try to use request host header for remote scenarios
      const host = req.headers.host;
      if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
        baseUrl = `http://${host.split(':')[0]}`; // Use host without port
      } else {
        baseUrl = 'http://127.0.0.1';
      }
    }

    const oauthUrl = `${baseUrl}:${CANVA_OAUTH_PORT}/connect`;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      url: oauthUrl,
      message: 'Open this URL in your browser to connect Canva',
      note: PUBLIC_BASE_URL ? 'Using configured PUBLIC_BASE_URL' : 'Set PUBLIC_BASE_URL env for remote access'
    }));

  } else if (url.pathname === '/api/connect/canva' && req.method === 'POST') {
    // DEPRECATED: Manual token injection - use OAuth flow instead
    // SECURITY: Requires admin secret AND ALLOW_MANUAL_TOKEN_IMPORT=true
    if (!checkAdminAuth(url, res)) return;

    if (!ALLOW_MANUAL_TOKEN_IMPORT) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Manual token import disabled',
        message: 'Use OAuth flow via /api/canva/connect-url instead. Set ALLOW_MANUAL_TOKEN_IMPORT=true to enable this deprecated endpoint.'
      }));
      return;
    }

    // Connect Canva - accept new token and persist to token store
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { token, refreshToken, expiresAt, expiresIn } = JSON.parse(body);
        if (!token) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Token required' }));
          return;
        }

        // Calculate expiresIn if expiresAt was provided
        let expiry = expiresIn || 14400; // Default 4 hours
        if (expiresAt && !expiresIn) {
          expiry = Math.floor((expiresAt - Date.now()) / 1000);
        }

        // Save to token store (persists to disk)
        tokenStore.setCanvaTokens(token, refreshToken, expiry);

        // Update runtime state
        connectedServices.canva = true;
        if (!campaignManager) {
          campaignManager = new CampaignManager({
            outputDir: path.join(__dirname, 'campaigns')
          });
        }
        campaignManager.init(token, process.env.ELEVENLABS_API_KEY);

        console.log('[TJ] Canva connected via manual import (admin action, deprecated)');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Canva connected (deprecated method)',
          hasRefreshToken: !!refreshToken,
          expiresIn: expiry
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;

  } else if (url.pathname.startsWith('/campaigns/') && req.method === 'GET') {
    // Serve static files from campaigns directory
    const filePath = url.pathname.replace('/campaigns/', '');
    serveStaticFile(req, res, filePath);

  // ==================== CANVA AI ENDPOINTS ====================

  } else if (url.pathname === '/api/ai/prompts' && req.method === 'POST') {
    // Generate Canva AI prompts from campaign data
    try {
      const body = await parseBody(req);
      const result = await prepareCampaignPrompts(body);

      // Add to queue for tracking
      result.prompts.forEach((p, i) => {
        const queueItem = canvaAIQueue.addPending(body.name || 'campaign', {
          ...p,
          campaignName: body.name,
          index: i
        });
        p.queueId = queueItem.id;
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        ...result,
        instructions: 'Copy each prompt to Canva AI (canva.com/ai), generate the video, then submit the design ID back via /api/ai/designs'
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }

  } else if (url.pathname === '/api/ai/designs' && req.method === 'POST') {
    // Submit design IDs after generating in Canva AI
    try {
      const body = await parseBody(req);
      const { queueId, designIdOrUrl, designs } = body;

      const results = [];

      // Handle single design submission
      if (queueId && designIdOrUrl) {
        const item = canvaAIQueue.complete(queueId, designIdOrUrl);
        results.push(item);
      }

      // Handle batch design submission
      if (designs && Array.isArray(designs)) {
        designs.forEach(d => {
          if (d.queueId && d.designIdOrUrl) {
            const item = canvaAIQueue.complete(d.queueId, d.designIdOrUrl);
            results.push(item);
          }
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        completed: results.length,
        designs: results
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }

  } else if (url.pathname === '/api/ai/queue' && req.method === 'GET') {
    // Get current queue status
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      pending: canvaAIQueue.getPending(),
      completed: canvaAIQueue.queue.completed.slice(-20) // Last 20 completed
    }));

  } else if (url.pathname === '/api/ai/export-jobs' && req.method === 'POST') {
    // Create a new export job (async - returns immediately)
    try {
      const body = await parseBody(req);
      const { designId, campaignName } = body;

      if (!designId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'designId is required' }));
        return;
      }

      // Get token from store (with auto-refresh) or env fallback
      const canvaToken = await getCanvaToken();
      if (!canvaToken) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Canva not connected. Use /api/canva/connect-url to connect.'
        }));
        return;
      }

      // Create job (fast - just stores in memory)
      const job = exportJobManager.createJob(designId, campaignName || 'export');

      // Start async processing (non-blocking)
      setImmediate(() => {
        exportJobManager.processJob(job.jobId, canvaToken, canvaExporter);
      });

      // Return immediately with job ID
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        jobId: job.jobId,
        status: job.status,
        message: 'Export job created. Poll GET /api/ai/export-jobs/:jobId for status.'
      }));

    } catch (error) {
      console.error('[TJ] Export job creation error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }

  } else if (url.pathname.startsWith('/api/ai/export-jobs/') && req.method === 'GET') {
    // Get export job status
    try {
      const jobId = url.pathname.split('/').pop();
      const job = exportJobManager.getJob(jobId);

      if (!job) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Job not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        job: {
          jobId: job.jobId,
          designId: job.designId,
          campaignName: job.campaignName,
          status: job.status,
          progress: job.progress,
          downloadUrls: job.downloadUrls,
          thumbnailUrl: job.thumbnailUrl,
          error: job.error,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt
        }
      }));

    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }

  } else if (url.pathname === '/api/ai/export-jobs' && req.method === 'GET') {
    // List all export jobs
    try {
      const statusFilter = url.searchParams.get('status');
      const jobs = exportJobManager.getAllJobs(statusFilter);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        total: jobs.length,
        jobs: jobs.slice(0, 50) // Limit to last 50
      }));

    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }

  } else if (url.pathname === '/api/ai/batch-export-jobs' && req.method === 'POST') {
    // Create multiple export jobs at once
    try {
      const body = await parseBody(req);
      const { designIds, campaignName } = body;

      if (!designIds || !Array.isArray(designIds) || designIds.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'designIds array is required' }));
        return;
      }

      // Get token from store (with auto-refresh) or env fallback
      const canvaToken = await getCanvaToken();
      if (!canvaToken) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Canva not connected' }));
        return;
      }

      // Create jobs for each design (fast)
      const jobs = designIds.map(designId =>
        exportJobManager.createJob(designId, campaignName || 'batch-export')
      );

      // Start async processing for each (non-blocking, staggered)
      jobs.forEach((job, index) => {
        setTimeout(() => {
          exportJobManager.processJob(job.jobId, canvaToken, canvaExporter);
        }, index * 2000); // Stagger by 2 seconds
      });

      // Return immediately with job IDs
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        total: jobs.length,
        jobs: jobs.map(j => ({ jobId: j.jobId, designId: j.designId, status: j.status })),
        message: 'Export jobs created. Poll GET /api/ai/export-jobs/:jobId for each job status.'
      }));

    } catch (error) {
      console.error('[TJ] Batch export job creation error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }

  // ==================== END CANVA AI ENDPOINTS ====================

  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Start server
initManager();

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ████████╗ ██████╗  █████╗  ██████╗████████╗██╗ ██████╗  ║
║   ╚══██╔══╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗ ║
║      ██║   ██████╔╝███████║██║        ██║   ██║██║   ██║ ║
║      ██║   ██╔══██╗██╔══██║██║        ██║   ██║██║   ██║ ║
║      ██║   ██║  ██║██║  ██║╚██████╗   ██║   ██║╚██████╔╝ ║
║      ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝  ║
║                     JACKSON                               ║
║                                                           ║
║   AI Video Ad Creative Generator                          ║
║   Server running at http://localhost:${PORT}                 ║
║                                                           ║
║   Services:                                               ║
║   • Canva: ${connectedServices.canva ? '✓ Connected' : '✗ Not connected'}                              ║
║   • ElevenLabs: ${connectedServices.elevenlabs ? '✓ Connected' : '✗ Not connected'}                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = server;
