// token-store.js - Persistent token storage for TractionJackson
// Stores Canva OAuth tokens with auto-refresh support

const fs = require('fs');
const path = require('path');
const https = require('https');

const DEFAULT_STORE_PATH = path.join(__dirname, 'data', 'tokens.json');
const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';

// Buffer time before expiry to trigger refresh (5 minutes)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

class TokenStore {
  constructor(options = {}) {
    this.storePath = options.storePath || DEFAULT_STORE_PATH;
    this.tokens = {
      canva: null
    };

    // Ensure data directory exists
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[TokenStore] Created directory: ${dir}`);
    }

    // Load existing tokens
    this.load();
  }

  /**
   * Load tokens from disk
   */
  load() {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf8');
        this.tokens = JSON.parse(data);
        console.log('[TokenStore] Loaded tokens from disk');

        // Log status without exposing tokens
        if (this.tokens.canva) {
          const expiresAt = this.tokens.canva.expires_at;
          const isExpired = Date.now() > expiresAt;
          const hasRefresh = !!this.tokens.canva.refresh_token;
          console.log(`[TokenStore] Canva token: ${isExpired ? 'EXPIRED' : 'valid'}, refresh_token: ${hasRefresh ? 'yes' : 'no'}`);
        }
      }
    } catch (error) {
      console.error('[TokenStore] Failed to load tokens:', error.message);
    }
  }

  /**
   * Save tokens to disk
   */
  save() {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.tokens, null, 2));
      console.log('[TokenStore] Saved tokens to disk');
    } catch (error) {
      console.error('[TokenStore] Failed to save tokens:', error.message);
    }
  }

  /**
   * Store Canva tokens
   */
  setCanvaTokens(accessToken, refreshToken, expiresIn) {
    const expiresAt = Date.now() + (expiresIn * 1000);

    this.tokens.canva = {
      access_token: accessToken,
      refresh_token: refreshToken || this.tokens.canva?.refresh_token || null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString()
    };

    this.save();
    console.log(`[TokenStore] Canva tokens saved, expires at ${new Date(expiresAt).toISOString()}`);
  }

  /**
   * Get Canva access token (raw, no refresh check)
   */
  getCanvaAccessToken() {
    return this.tokens.canva?.access_token || null;
  }

  /**
   * Get Canva refresh token
   */
  getCanvaRefreshToken() {
    return this.tokens.canva?.refresh_token || null;
  }

  /**
   * Check if Canva token is expired or near expiry
   */
  isCanvaTokenExpired() {
    if (!this.tokens.canva?.access_token) {
      return true;
    }
    const expiresAt = this.tokens.canva.expires_at || 0;
    return Date.now() > (expiresAt - REFRESH_BUFFER_MS);
  }

  /**
   * Check if we have a valid Canva connection
   */
  hasValidCanvaConnection() {
    return !!this.tokens.canva?.access_token && !this.isCanvaTokenExpired();
  }

  /**
   * Get diagnostic info for /api/status (no secrets)
   */
  getCanvaStatus() {
    if (!this.tokens.canva) {
      return { connected: false, reason: 'no_tokens' };
    }

    const hasAccessToken = !!this.tokens.canva.access_token;
    const hasRefreshToken = !!this.tokens.canva.refresh_token;
    const expiresAt = this.tokens.canva.expires_at;
    const isExpired = Date.now() > expiresAt;
    const expiresIn = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));

    return {
      connected: hasAccessToken && !isExpired,
      hasAccessToken,
      hasRefreshToken,
      isExpired,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      expiresInSeconds: expiresIn,
      canAutoRefresh: hasRefreshToken && isExpired
    };
  }

  /**
   * Refresh Canva access token using refresh token
   */
  async refreshCanvaToken(clientId, clientSecret) {
    const refreshToken = this.getCanvaRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    console.log('[TokenStore] Refreshing Canva access token...');

    return new Promise((resolve, reject) => {
      const data = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }).toString();

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
              // Store new tokens
              this.setCanvaTokens(
                result.access_token,
                result.refresh_token, // May be a new refresh token
                result.expires_in || 14400
              );
              console.log('[TokenStore] Token refresh successful');
              resolve(result.access_token);
            } else {
              console.error('[TokenStore] Token refresh failed:', result);
              // If refresh token is invalid, clear tokens
              if (result.error === 'invalid_grant') {
                this.clearCanvaTokens();
              }
              reject(new Error(result.error_description || result.error || 'Token refresh failed'));
            }
          } catch (e) {
            reject(new Error('Failed to parse refresh response'));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  /**
   * Get a valid Canva access token, refreshing if necessary
   */
  async getValidCanvaToken(clientId, clientSecret) {
    // If token is valid, return it
    if (this.hasValidCanvaConnection()) {
      return this.getCanvaAccessToken();
    }

    // If expired but we have refresh token, try to refresh
    if (this.getCanvaRefreshToken() && clientId && clientSecret) {
      try {
        return await this.refreshCanvaToken(clientId, clientSecret);
      } catch (error) {
        console.error('[TokenStore] Auto-refresh failed:', error.message);
        throw error;
      }
    }

    // No valid token and can't refresh
    return null;
  }

  /**
   * Clear Canva tokens
   */
  clearCanvaTokens() {
    this.tokens.canva = null;
    this.save();
    console.log('[TokenStore] Canva tokens cleared');
  }
}

// Singleton instance
let instance = null;

function getTokenStore(options = {}) {
  if (!instance) {
    instance = new TokenStore(options);
  }
  return instance;
}

module.exports = {
  TokenStore,
  getTokenStore
};
