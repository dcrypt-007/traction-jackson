// canva-api.js - Canva Connect API Client
const https = require('https');

const CANVA_API_BASE = 'https://api.canva.com/rest/v1';

/**
 * Make authenticated request to Canva API
 */
function canvaRequest(endpoint, accessToken, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CANVA_API_BASE}${endpoint}`);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[Canva API] ${method} ${endpoint} → ${res.statusCode}`);
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            console.error('[Canva API] Error:', parsed);
            reject(new Error(parsed.message || parsed.error?.message || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error('Failed to parse Canva response'));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * List all designs in user's Canva account
 * Docs: https://www.canva.dev/docs/connect/endpoints/designs/list-designs/
 */
async function listDesigns(accessToken, options = {}) {
  const params = new URLSearchParams();

  // Optional filters
  if (options.query) params.set('query', options.query);
  if (options.continuation) params.set('continuation', options.continuation);
  if (options.ownership) params.set('ownership', options.ownership); // 'owned' | 'shared' | 'any'

  const endpoint = `/designs${params.toString() ? '?' + params.toString() : ''}`;
  return canvaRequest(endpoint, accessToken);
}

/**
 * Get single design details
 */
async function getDesign(accessToken, designId) {
  return canvaRequest(`/designs/${designId}`, accessToken);
}

/**
 * List Brand Templates (requires Canva for Teams)
 * Docs: https://www.canva.dev/docs/connect/endpoints/brand-templates/list-brand-templates/
 */
async function listBrandTemplates(accessToken, options = {}) {
  const params = new URLSearchParams();
  if (options.continuation) params.set('continuation', options.continuation);

  const endpoint = `/brand-templates${params.toString() ? '?' + params.toString() : ''}`;
  return canvaRequest(endpoint, accessToken);
}

/**
 * Get Brand Template dataset (fields available for autofill)
 * Docs: https://www.canva.dev/docs/connect/endpoints/brand-templates/get-brand-template-dataset/
 */
async function getBrandTemplateDataset(accessToken, templateId) {
  return canvaRequest(`/brand-templates/${templateId}/dataset`, accessToken);
}

/**
 * List templates - uses regular designs since Brand Templates require special scopes
 * (Brand Templates API requires brandtemplate:meta:read scope which isn't granted to Draft apps)
 */
async function listVideoTemplates(accessToken) {
  // Skip Brand Templates API - it requires special scopes that Draft apps don't get
  // Go directly to regular designs which work with design:* scopes
  console.log('[TJ] Fetching templates (using regular designs)...');
  return listDesignsAsTemplates(accessToken);
}

/**
 * Fallback: List regular designs if Brand Templates unavailable
 * Now shows ALL designs (not just video-filtered) since Brand Templates require special scopes
 */
async function listDesignsAsTemplates(accessToken) {
  const allDesigns = [];
  let continuation = null;

  console.log('[TJ] Fetching designs from Canva (using regular designs as templates)...');

  do {
    const response = await listDesigns(accessToken, {
      ownership: 'owned',
      continuation
    });

    if (response.items) {
      allDesigns.push(...response.items);
    }
    continuation = response.continuation;

    console.log(`[TJ] Fetched ${allDesigns.length} designs so far...`);
  } while (continuation);

  // Optionally filter for video designs (but we'll show all designs as primary)
  const videoDesigns = allDesigns.filter(design => {
    const type = design.type?.toLowerCase() || '';
    const title = design.title?.toLowerCase() || '';
    return (
      type.includes('video') ||
      type.includes('mp4') ||
      title.includes('video') ||
      title.includes('ad') ||
      title.includes('tj-')
    );
  });

  console.log(`[TJ] Found ${allDesigns.length} total designs (${videoDesigns.length} are video-related)`);

  // Return ALL designs as items (not just video-filtered)
  // This ensures users can use any design as a template
  return {
    total: allDesigns.length,
    items: allDesigns,  // Changed: Show ALL designs, not just videos
    videos: videoDesigns,
    all: allDesigns
  };
}

/**
 * Display templates in readable format
 */
function displayTemplates(templates) {
  console.log('\n=== VIDEO TEMPLATES ===\n');

  if (templates.videos.length === 0) {
    console.log('No video templates found.');
    console.log('\nAll designs:');
    templates.all.slice(0, 10).forEach((d, i) => {
      console.log(`  ${i + 1}. [${d.type || 'unknown'}] ${d.title || 'Untitled'} (${d.id})`);
    });
    return;
  }

  templates.videos.forEach((design, i) => {
    console.log(`${i + 1}. ${design.title || 'Untitled'}`);
    console.log(`   ID: ${design.id}`);
    console.log(`   Type: ${design.type || 'N/A'}`);
    console.log(`   Created: ${design.created_at || 'N/A'}`);
    console.log(`   URL: ${design.url || 'N/A'}`);
    console.log('');
  });
}

// ============ CLI Runner ============
async function main() {
  const accessToken = process.env.CANVA_ACCESS_TOKEN || process.argv[2];

  if (!accessToken) {
    console.error('Usage: CANVA_ACCESS_TOKEN=xxx node canva-api.js');
    console.error('   or: node canva-api.js <access_token>');
    process.exit(1);
  }

  try {
    const templates = await listVideoTemplates(accessToken);
    displayTemplates(templates);

    // Output JSON for programmatic use
    console.log('\n=== JSON OUTPUT ===');
    console.log(JSON.stringify(templates.videos, null, 2));

  } catch (error) {
    console.error('[TJ] Error:', error.message);
    process.exit(1);
  }
}

// Export for module use
module.exports = {
  canvaRequest,
  listDesigns,
  getDesign,
  listBrandTemplates,
  getBrandTemplateDataset,
  listVideoTemplates,
  listDesignsAsTemplates
};

// Run if called directly
if (require.main === module) {
  main();
}
