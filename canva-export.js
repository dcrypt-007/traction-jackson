// canva-export.js - Canva Video Export Pipeline for TractionJackson
const https = require('https');
const fs = require('fs');
const path = require('path');

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
 * Export formats supported by Canva
 */
const EXPORT_FORMATS = {
  // Video formats (Canva API requires resolution-based quality values)
  MP4: { type: 'mp4', quality: 'horizontal_1080p' },
  MP4_HD: { type: 'mp4', quality: 'horizontal_1080p' },
  MP4_4K: { type: 'mp4', quality: 'horizontal_4k' },
  MP4_VERTICAL: { type: 'mp4', quality: 'vertical_1080p' },
  GIF: { type: 'gif' },

  // Image formats (for thumbnails)
  PNG: { type: 'png' },
  JPG: { type: 'jpg', quality: 80 },
  PDF: { type: 'pdf' }
};

/**
 * Start an export job for a design
 * Docs: https://www.canva.dev/docs/connect/endpoints/exports/create-design-export-job/
 */
async function createExportJob(accessToken, designId, format = 'mp4', options = {}) {
  console.log(`[TJ] Starting export: ${designId} as ${format}`);

  const body = {
    design_id: designId,
    format: {
      type: format,
      ...options
    }
  };

  // For video, can specify pages/quality
  if (format === 'mp4') {
    body.format.quality = options.quality || 'horizontal_1080p';  // horizontal_480p/720p/1080p/4k or vertical_*
    // For multi-page videos, can specify: body.format.pages = [1, 2, 3];
  }

  const response = await canvaRequest('/exports', accessToken, 'POST', body);
  console.log('[TJ] Export job created:', response.job?.id);
  return response;
}

/**
 * Get export job status
 */
async function getExportJob(accessToken, jobId) {
  return canvaRequest(`/exports/${jobId}`, accessToken);
}

/**
 * Wait for export to complete and return download URL
 */
async function waitForExport(accessToken, jobId, maxWaitMs = 300000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const job = await getExportJob(accessToken, jobId);

    console.log(`[TJ] Export status: ${job.job?.status}`);

    if (job.job?.status === 'completed' || job.job?.status === 'success') {
      const urls = job.job?.result?.urls || [];
      console.log(`[TJ] Export completed! ${urls.length} file(s) ready`);
      return {
        status: 'completed',
        urls: urls,
        job: job.job
      };
    }

    if (job.job?.status === 'failed') {
      throw new Error(`Export failed: ${job.job?.error?.message || 'Unknown error'}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  throw new Error('Export job timed out');
}

/**
 * Download exported file
 */
async function downloadExport(url, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`[TJ] Downloading: ${outputPath}`);

    const file = fs.createWriteStream(outputPath);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`[TJ] Downloaded: ${outputPath}`);
            resolve(outputPath);
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`[TJ] Downloaded: ${outputPath}`);
          resolve(outputPath);
        });
      }
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Clean up
      reject(err);
    });
  });
}

/**
 * Export a design and get CDN URLs only (no server-side download)
 * This is the preferred stable method - returns Canva CDN URLs for direct playback
 */
async function exportCDNOnly(accessToken, designId, options = {}) {
  const {
    format = 'mp4',
    quality = 'regular'
  } = options;

  // Start export
  const exportJob = await createExportJob(accessToken, designId, format, { quality });

  // Wait for completion
  const result = await waitForExport(accessToken, exportJob.job.id);

  console.log(`[TJ] CDN export complete: ${result.urls.length} URL(s) ready`);

  return {
    success: true,
    designId: designId,
    format: format,
    urls: result.urls  // CDN URLs for direct streaming/download
  };
}

/**
 * Export a design and download the result (DEPRECATED - use exportCDNOnly for stability)
 */
async function exportAndDownload(accessToken, designId, options = {}) {
  const {
    format = 'mp4',
    quality = 'regular',
    outputDir = process.cwd(),
    filename = null
  } = options;

  // Start export
  const exportJob = await createExportJob(accessToken, designId, format, { quality });

  // Wait for completion
  const result = await waitForExport(accessToken, exportJob.job.id);

  // Download files
  const downloads = [];
  for (let i = 0; i < result.urls.length; i++) {
    const url = result.urls[i];
    const ext = format === 'mp4' ? 'mp4' : format;
    const outputFilename = filename || `${designId}_${i + 1}.${ext}`;
    const outputPath = path.join(outputDir, outputFilename);

    await downloadExport(url, outputPath);
    downloads.push(outputPath);
  }

  return {
    success: true,
    designId: designId,
    format: format,
    files: downloads,
    urls: result.urls  // Include remote URLs for streaming/preview
  };
}

/**
 * Batch export multiple designs
 */
async function batchExport(accessToken, designIds, options = {}) {
  console.log(`[TJ] Batch exporting ${designIds.length} designs...`);

  const results = [];

  for (let i = 0; i < designIds.length; i++) {
    const designId = designIds[i];
    console.log(`[TJ] Exporting ${i + 1}/${designIds.length}: ${designId}`);

    try {
      const result = await exportAndDownload(accessToken, designId, options);
      results.push(result);
    } catch (error) {
      console.error(`[TJ] Export failed for ${designId}:`, error.message);
      results.push({
        success: false,
        designId: designId,
        error: error.message
      });
    }
  }

  const successful = results.filter(r => r.success).length;
  console.log(`[TJ] Batch export complete: ${successful}/${designIds.length} successful`);

  return results;
}

/**
 * Generate thumbnail for a video design
 */
async function generateThumbnail(accessToken, designId, outputDir = process.cwd()) {
  console.log(`[TJ] Generating thumbnail for: ${designId}`);

  const result = await exportAndDownload(accessToken, designId, {
    format: 'png',
    outputDir: outputDir,
    filename: `${designId}_thumb.png`
  });

  return result;
}

// ============ CLI Runner ============
async function main() {
  const accessToken = process.env.CANVA_ACCESS_TOKEN || process.argv[2];
  const designId = process.argv[3];
  const format = process.argv[4] || 'mp4';

  if (!accessToken || !designId) {
    console.error('Usage: CANVA_ACCESS_TOKEN=xxx node canva-export.js <design_id> [format]');
    console.error('Formats: mp4, gif, png, jpg, pdf');
    process.exit(1);
  }

  try {
    console.log('\n=== EXPORTING DESIGN ===\n');

    const result = await exportAndDownload(accessToken, designId, {
      format: format,
      quality: 'high'
    });

    console.log('\n=== RESULT ===');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('[TJ] Error:', error.message);
    process.exit(1);
  }
}

// Export for module use
module.exports = {
  createExportJob,
  getExportJob,
  waitForExport,
  downloadExport,
  exportAndDownload,  // DEPRECATED - use exportCDNOnly
  exportCDNOnly,      // PREFERRED - no server-side downloads
  batchExport,
  generateThumbnail,
  EXPORT_FORMATS
};

// Run if called directly
if (require.main === module) {
  main();
}
