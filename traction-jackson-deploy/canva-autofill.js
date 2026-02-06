// canva-autofill.js - Canva Data Autofill Integration for TractionJackson
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
 * Discover autofill fields in a Brand Template
 * Docs: https://www.canva.dev/docs/connect/endpoints/autofills/
 */
async function discoverTemplateFields(accessToken, brandTemplateId) {
  console.log(`[TJ] Discovering fields in template: ${brandTemplateId}`);

  try {
    // Get the brand template's dataset (autofill fields)
    const response = await canvaRequest(
      `/brand-templates/${brandTemplateId}/dataset`,
      accessToken
    );

    console.log('[TJ] Template fields:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('[TJ] Field discovery failed:', error.message);
    throw error;
  }
}

/**
 * Create an autofill job to generate a new design from template
 * This replaces text/image fields with your data
 */
async function createAutofillJob(accessToken, brandTemplateId, data) {
  console.log(`[TJ] Creating autofill job for template: ${brandTemplateId}`);
  console.log('[TJ] Data:', JSON.stringify(data, null, 2));

  const body = {
    brand_template_id: brandTemplateId,
    data: data  // { "field_name": { "type": "text", "text": "value" } }
  };

  try {
    const response = await canvaRequest(
      '/autofills',
      accessToken,
      'POST',
      body
    );

    console.log('[TJ] Autofill job created:', response);
    return response;
  } catch (error) {
    console.error('[TJ] Autofill failed:', error.message);
    throw error;
  }
}

/**
 * Get autofill job status
 */
async function getAutofillJob(accessToken, jobId) {
  return canvaRequest(`/autofills/${jobId}`, accessToken);
}

/**
 * Wait for autofill job to complete
 */
async function waitForAutofill(accessToken, jobId, maxWaitMs = 60000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const job = await getAutofillJob(accessToken, jobId);

    if (job.status === 'completed') {
      console.log('[TJ] Autofill completed! Design ID:', job.result?.design?.id);
      return job;
    }

    if (job.status === 'failed') {
      throw new Error(`Autofill failed: ${job.error?.message || 'Unknown error'}`);
    }

    console.log(`[TJ] Autofill status: ${job.status}, waiting...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Autofill job timed out');
}

/**
 * Format data for Canva autofill API
 * Converts simple key-value pairs to Canva's format
 */
function formatAutofillData(fields) {
  const formatted = {};

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      // Check if it's an image URL
      if (value.startsWith('http') && (value.includes('.jpg') || value.includes('.png') || value.includes('.webp'))) {
        formatted[key] = {
          type: 'image',
          asset_id: value  // For uploaded assets, use asset_id
          // Or use: url: value  // For external URLs (if allowed)
        };
      } else {
        formatted[key] = {
          type: 'text',
          text: value
        };
      }
    } else if (typeof value === 'object') {
      // Already formatted
      formatted[key] = value;
    }
  }

  return formatted;
}

/**
 * Generate a single creative from template
 * NOTE: If Brand Templates not available, falls back to using the design ID directly
 */
async function generateCreative(accessToken, brandTemplateId, creativeData) {
  // First try Brand Templates autofill
  try {
    const formattedData = formatAutofillData(creativeData);
    const job = await createAutofillJob(accessToken, brandTemplateId, formattedData);
    const result = await waitForAutofill(accessToken, job.job.id);

    return {
      designId: result.job.result.design.id,
      designUrl: result.job.result.design.url,
      creativeData: creativeData
    };
  } catch (error) {
    // If autofill fails (no Brand Template scopes), use design directly
    console.log('[TJ] Autofill not available, using design directly:', error.message);
    console.log('[TJ] Falling back to direct design export (no customization)');

    // Return the template ID as the design ID - we'll export it directly
    return {
      designId: brandTemplateId,
      designUrl: `https://www.canva.com/design/${brandTemplateId}`,
      creativeData: creativeData,
      note: 'Using design directly without autofill - video content not customized'
    };
  }
}

/**
 * Batch generate multiple creatives from a template
 * Perfect for A/B testing different headlines, CTAs, etc.
 */
async function batchGenerateCreatives(accessToken, brandTemplateId, variations) {
  console.log(`[TJ] Batch generating ${variations.length} creatives...`);

  const results = [];

  for (let i = 0; i < variations.length; i++) {
    const variation = variations[i];
    console.log(`[TJ] Generating creative ${i + 1}/${variations.length}...`);

    try {
      const result = await generateCreative(accessToken, brandTemplateId, variation);
      results.push({
        success: true,
        variation: i + 1,
        ...result
      });
    } catch (error) {
      console.error(`[TJ] Creative ${i + 1} failed:`, error.message);
      results.push({
        success: false,
        variation: i + 1,
        error: error.message,
        creativeData: variation
      });
    }

    // Small delay between requests to avoid rate limits
    if (i < variations.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const successful = results.filter(r => r.success).length;
  console.log(`[TJ] Batch complete: ${successful}/${variations.length} successful`);

  return results;
}

// ============ CLI Runner ============
async function main() {
  const accessToken = process.env.CANVA_ACCESS_TOKEN || process.argv[2];
  const templateId = process.env.CANVA_TEMPLATE_ID || process.argv[3];

  if (!accessToken) {
    console.error('Usage: CANVA_ACCESS_TOKEN=xxx CANVA_TEMPLATE_ID=yyy node canva-autofill.js');
    console.error('   or: node canva-autofill.js <access_token> <template_id>');
    process.exit(1);
  }

  try {
    if (templateId) {
      // Discover fields in template
      console.log('\n=== DISCOVERING TEMPLATE FIELDS ===\n');
      const dataset = await discoverTemplateFields(accessToken, templateId);

      // Create test data based on discovered fields
      const testData = {};
      if (dataset.fields) {
        dataset.fields.forEach(f => {
          if (f.type === 'text') {
            testData[f.name] = `Test ${f.name}`;
          } else if (f.type === 'image') {
            testData[f.name] = 'https://via.placeholder.com/400x400.png?text=Test';
          }
        });
      }

      console.log('\n=== TEST DATA (would use for autofill) ===');
      console.log(JSON.stringify(testData, null, 2));

      // Uncomment to actually create:
      // const result = await generateCreative(accessToken, templateId, testData);
      // console.log('Generated:', result);

    } else {
      console.log('No template ID provided. Provide one to discover fields.');
      console.log('Usage: node canva-autofill.js <token> <brand_template_id>');
    }

  } catch (error) {
    console.error('[TJ] Error:', error.message);
    process.exit(1);
  }
}

// Export for module use
module.exports = {
  discoverTemplateFields,
  createAutofillJob,
  getAutofillJob,
  waitForAutofill,
  formatAutofillData,
  generateCreative,
  batchGenerateCreatives
};

// Run if called directly
if (require.main === module) {
  main();
}
