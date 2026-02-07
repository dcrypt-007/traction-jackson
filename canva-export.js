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
 * Canva API response: { job: { id, status, urls: ["https://..."] } }
 */
async function waitForExport(accessToken, jobId, maxWaitMs = 300000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const job = await getExportJob(accessToken, jobId);

    console.log(`[TJ] Export status: ${job.job?.status}`);

    if (job.job?.status === 'completed' || job.job?.status === 'success') {
      // CRITICAL FIX: Canva API returns urls directly on job object, NOT under result
      // Canva v1 API: { job: { status: "success", urls: ["https://..."] } }
      // Check both locations for forward-compatibility
      const urls = job.job?.urls || job.job?.result?.urls || [];

      if (urls.length === 0) {
        // Log full response structure to help debug if URLs still missing
        console.error('[TJ] WARNING: Export succeeded but no URLs found in response');
        console.error('[TJ] Response keys:', JSON.stringify(Object.keys(job.job || {})));
        console.error('[TJ] Full job object:', JSON.stringify(job.job, null, 2));
      }

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
 * Follow redirects and download a file (handles up to 5 redirects)
 */
function followRedirectAndDownload(url, outputPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many redirects'));
      return;
    }

    const protocol = url.startsWith('http://') ? require('http') : https;

    protocol.get(url, (response) => {
      // Follow redirects (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        console.log(`[TJ] Following redirect ${response.statusCode} → ${response.headers.location}`);
        followRedirectAndDownload(response.headers.location, outputPath, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      // Check for HTTP errors
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`Download failed: HTTP ${response.statusCode}`));
        return;
      }

      // Pipe to file
      const file = fs.createWriteStream(outputPath);
      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          // Verify file was actually written and has content
          try {
            const stats = fs.statSync(outputPath);
            if (stats.size === 0) {
              fs.unlinkSync(outputPath);
              reject(new Error('Downloaded file is empty (0 bytes)'));
            } else {
              console.log(`[TJ] Downloaded: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
              resolve(outputPath);
            }
          } catch (e) {
            reject(new Error(`Failed to verify download: ${e.message}`));
          }
        });
      });

      file.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

/**
 * Download exported file
 */
async function downloadExport(url, outputPath) {
  console.log(`[TJ] Downloading: ${url.substring(0, 80)}... → ${outputPath}`);
  return followRedirectAndDownload(url, outputPath);
}

/**
 * Export a design and get CDN URLs only (no server-side download)
 * This is the preferred stable method - returns Canva CDN URLs for direct playback
 */
async function exportCDNOnly(accessToken, designId, options = {}) {
  const {
    format = 'mp4',
    quality = 'horizontal_1080p'
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
 * Export a design and download the result to server disk
 */
async function exportAndDownload(accessToken, designId, options = {}) {
  const {
    format = 'mp4',
    quality = 'horizontal_1080p',
    outputDir = process.cwd(),
    filename = null
  } = options;

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Start export
  const exportJob = await createExportJob(accessToken, designId, format, { quality });

  // Wait for completion
  const result = await waitForExport(accessToken, exportJob.job.id);

  if (result.urls.length === 0) {
    throw new Error('Export completed but returned no download URLs');
  }

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

  console.log(`[TJ] Export + download complete: ${downloads.length} file(s) saved`);

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
      quality: 'horizontal_1080p'
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
  exportAndDownload,
  exportCDNOnly,
  batchExport,
  generateThumbnail,
  EXPORT_FORMATS
};

// Run if called directly
if (require.main === module) {
  main();
}
