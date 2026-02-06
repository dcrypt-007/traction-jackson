// campaign-manager.js - TractionJackson Campaign Orchestrator
// Ties together: Canva Templates + Autofill + 11Labs Voiceover + Export

const path = require('path');
const fs = require('fs');

// Import our modules
const { listVideoTemplates } = require('./canva-api');
const { discoverTemplateFields, generateCreative, batchGenerateCreatives } = require('./canva-autofill');
const { generateVideoVoiceover, batchGenerateVoiceovers, RECOMMENDED_VOICES } = require('./elevenlabs-voice');
const { exportAndDownload, batchExport, generateThumbnail } = require('./canva-export');
const { mergeVideoAudio, checkFfmpeg } = require('./ffmpeg-merge');

/**
 * Campaign configuration
 */
const DEFAULT_CONFIG = {
  outputDir: './campaigns',
  voiceId: RECOMMENDED_VOICES.sarah.id,  // Default professional female voice
  exportFormat: 'mp4',
  exportQuality: 'high'
};

/**
 * Campaign Manager - orchestrates the entire creative generation pipeline
 */
class CampaignManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.canvaToken = null;
    this.elevenLabsKey = null;
  }

  /**
   * Initialize with API credentials
   */
  init(canvaToken, elevenLabsKey) {
    this.canvaToken = canvaToken;
    this.elevenLabsKey = elevenLabsKey;
    console.log('[TJ] Campaign Manager initialized');
    return this;
  }

  /**
   * Create campaign output directory
   */
  createCampaignDir(campaignName) {
    const timestamp = new Date().toISOString().split('T')[0];
    const dirName = `${campaignName}_${timestamp}`.replace(/\s+/g, '_').toLowerCase();
    const campaignDir = path.join(this.config.outputDir, dirName);

    if (!fs.existsSync(campaignDir)) {
      fs.mkdirSync(campaignDir, { recursive: true });
    }

    // Create subdirectories
    fs.mkdirSync(path.join(campaignDir, 'videos'), { recursive: true });
    fs.mkdirSync(path.join(campaignDir, 'voiceovers'), { recursive: true });
    fs.mkdirSync(path.join(campaignDir, 'thumbnails'), { recursive: true });

    console.log(`[TJ] Campaign directory: ${campaignDir}`);
    return campaignDir;
  }

  /**
   * List available video templates
   */
  async getTemplates() {
    if (!this.canvaToken) throw new Error('Canva token not set');
    return listVideoTemplates(this.canvaToken);
  }

  /**
   * Discover fields in a template
   */
  async getTemplateFields(templateId) {
    if (!this.canvaToken) throw new Error('Canva token not set');
    return discoverTemplateFields(this.canvaToken, templateId);
  }

  /**
   * Generate a single creative with voiceover
   */
  async generateSingleCreative(options) {
    const {
      templateId,
      creativeData,     // { headline: "...", cta: "...", product_image: "..." }
      voiceoverScript,  // Optional voiceover text
      campaignDir
    } = options;

    console.log('[TJ] === Generating Single Creative ===');

    const result = {
      success: false,
      creative: null,
      voiceover: null,
      export: null
    };

    // Step 1: Create the creative from template
    console.log('[TJ] Step 1: Creating creative from template...');
    try {
      result.creative = await generateCreative(
        this.canvaToken,
        templateId,
        creativeData
      );
      console.log(`[TJ] Creative created: ${result.creative.designId}`);
    } catch (error) {
      console.error('[TJ] Creative generation failed:', error.message);
      result.error = error.message;
      return result;
    }

    // Step 2: Generate voiceover (if script provided)
    if (voiceoverScript && this.elevenLabsKey) {
      console.log('[TJ] Step 2: Generating voiceover...');
      try {
        result.voiceover = await generateVideoVoiceover(
          this.elevenLabsKey,
          voiceoverScript,
          {
            voiceId: this.config.voiceId,
            outputDir: path.join(campaignDir, 'voiceovers'),
            prefix: `vo_${result.creative.designId.slice(-8)}`
          }
        );
        console.log(`[TJ] Voiceover generated: ${result.voiceover.filePath}`);
      } catch (error) {
        console.error('[TJ] Voiceover generation failed:', error.message);
        // Continue without voiceover
      }
    }

    // Step 3: Export the video
    console.log('[TJ] Step 3: Exporting video...');
    try {
      result.export = await exportAndDownload(
        this.canvaToken,
        result.creative.designId,
        {
          format: this.config.exportFormat,
          quality: this.config.exportQuality,
          outputDir: path.join(campaignDir, 'videos')
        }
      );
      console.log(`[TJ] Video exported: ${result.export.files[0]}`);

      // Store video URL for preview
      if (result.export.urls && result.export.urls.length > 0) {
        result.videoUrl = result.export.urls[0];
      }
      // Also store local path for serving
      if (result.export.files && result.export.files.length > 0) {
        result.localVideoPath = result.export.files[0];
      }
    } catch (error) {
      console.error('[TJ] Export failed:', error.message);
      result.exportError = error.message;
    }

    // Step 4: Generate thumbnail
    console.log('[TJ] Step 4: Generating thumbnail...');
    try {
      result.thumbnail = await generateThumbnail(
        this.canvaToken,
        result.creative.designId,
        path.join(campaignDir, 'thumbnails')
      );
      // Store thumbnail URL for preview
      if (result.thumbnail.urls && result.thumbnail.urls.length > 0) {
        result.thumbnailUrl = result.thumbnail.urls[0];
      }
      if (result.thumbnail.files && result.thumbnail.files.length > 0) {
        result.localThumbnailPath = result.thumbnail.files[0];
      }
    } catch (error) {
      console.error('[TJ] Thumbnail failed:', error.message);
    }

    // Step 5: Merge video + voiceover into single MP4 (TASK-003)
    if (result.voiceover?.filePath && result.localVideoPath) {
      console.log('[TJ] Step 5: Merging video + voiceover...');
      try {
        const ffmpegAvailable = await checkFfmpeg();
        if (ffmpegAvailable) {
          const mergedFilename = `${result.creative.designId}_final.mp4`;
          const mergeResult = await mergeVideoAudio(
            result.localVideoPath,
            result.voiceover.filePath,
            {
              outputDir: path.join(campaignDir, 'videos'),
              filename: mergedFilename,
              fadeIn: 0.3,
              fadeOut: 0.5
            }
          );

          if (mergeResult.success) {
            result.mergedVideo = mergeResult;
            result.finalVideoPath = mergeResult.outputPath;
            console.log(`[TJ] Merged video: ${mergeResult.outputPath}`);
          }
        } else {
          console.log('[TJ] ffmpeg not available - skipping merge');
          console.log('[TJ] Install with: npm install ffmpeg-static');
        }
      } catch (error) {
        console.error('[TJ] Merge failed:', error.message);
        result.mergeError = error.message;
      }
    }

    result.success = true;
    return result;
  }

  /**
   * Run a full campaign - generate multiple creative variations
   */
  async runCampaign(campaignConfig) {
    const {
      name,
      templateId,
      variations,       // Array of { creativeData, voiceoverScript }
      baseCreativeData, // Shared data across all variations
      voiceoverScripts  // Array of scripts (alternative to per-variation)
    } = campaignConfig;

    console.log(`\n[TJ] ========================================`);
    console.log(`[TJ] STARTING CAMPAIGN: ${name}`);
    console.log(`[TJ] Template: ${templateId}`);
    console.log(`[TJ] Variations: ${variations?.length || voiceoverScripts?.length || 1}`);
    console.log(`[TJ] ========================================\n`);

    // Create campaign directory
    const campaignDir = this.createCampaignDir(name);

    const results = {
      campaign: name,
      templateId: templateId,
      directory: campaignDir,
      creatives: [],
      summary: {
        total: 0,
        successful: 0,
        failed: 0
      }
    };

    // Build variations array
    let creativeVariations = variations || [];

    // If using separate scripts array, build variations
    if (!variations && voiceoverScripts) {
      creativeVariations = voiceoverScripts.map((script, i) => ({
        creativeData: { ...baseCreativeData },
        voiceoverScript: script
      }));
    }

    // If no variations, create single creative with base data
    if (creativeVariations.length === 0) {
      creativeVariations = [{
        creativeData: baseCreativeData,
        voiceoverScript: null
      }];
    }

    results.summary.total = creativeVariations.length;

    // Generate each variation
    for (let i = 0; i < creativeVariations.length; i++) {
      const variation = creativeVariations[i];
      console.log(`\n[TJ] --- Variation ${i + 1}/${creativeVariations.length} ---`);

      try {
        const creative = await this.generateSingleCreative({
          templateId: templateId,
          creativeData: variation.creativeData,
          voiceoverScript: variation.voiceoverScript,
          campaignDir: campaignDir
        });

        results.creatives.push({
          index: i + 1,
          ...creative
        });

        if (creative.success) {
          results.summary.successful++;
        } else {
          results.summary.failed++;
        }

      } catch (error) {
        console.error(`[TJ] Variation ${i + 1} failed:`, error.message);
        results.creatives.push({
          index: i + 1,
          success: false,
          error: error.message
        });
        results.summary.failed++;
      }

      // Delay between variations
      if (i < creativeVariations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Save campaign manifest
    const manifestPath = path.join(campaignDir, 'campaign-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2));
    console.log(`\n[TJ] Campaign manifest saved: ${manifestPath}`);

    // Print summary
    console.log(`\n[TJ] ========================================`);
    console.log(`[TJ] CAMPAIGN COMPLETE: ${name}`);
    console.log(`[TJ] Successful: ${results.summary.successful}/${results.summary.total}`);
    console.log(`[TJ] Output: ${campaignDir}`);
    console.log(`[TJ] ========================================\n`);

    return results;
  }
}

// ============ CLI Runner ============
async function main() {
  const canvaToken = process.env.CANVA_ACCESS_TOKEN;
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

  if (!canvaToken) {
    console.error('Required: CANVA_ACCESS_TOKEN environment variable');
    process.exit(1);
  }

  const manager = new CampaignManager({
    outputDir: './campaigns'
  }).init(canvaToken, elevenLabsKey);

  // Example campaign
  const demoCampaign = {
    name: 'Product Launch Demo',
    templateId: process.env.CANVA_TEMPLATE_ID || 'YOUR_TEMPLATE_ID',
    baseCreativeData: {
      headline: 'Transform Your Business Today',
      subheadline: 'AI-Powered Solutions',
      cta: 'Get Started Free'
    },
    voiceoverScripts: [
      'Transform your business with the power of AI. Get started today and see results in just 24 hours.',
      'Ready to scale? Our AI solutions help you grow faster than ever. Start your free trial now.',
      'Join thousands of successful businesses using AI to automate and accelerate growth.'
    ]
  };

  try {
    // List available templates first
    console.log('[TJ] Fetching available templates...');
    const templates = await manager.getTemplates();

    if (templates.videos.length > 0) {
      console.log(`\n[TJ] Found ${templates.videos.length} video templates`);
      templates.videos.slice(0, 5).forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.title} (${t.id})`);
      });
    }

    // Run demo campaign if template ID is provided
    if (process.env.CANVA_TEMPLATE_ID) {
      const results = await manager.runCampaign(demoCampaign);
      console.log('\n=== CAMPAIGN RESULTS ===');
      console.log(JSON.stringify(results.summary, null, 2));
    } else {
      console.log('\nTo run a campaign, set CANVA_TEMPLATE_ID environment variable');
    }

  } catch (error) {
    console.error('[TJ] Error:', error.message);
    process.exit(1);
  }
}

// Export for module use
module.exports = {
  CampaignManager,
  DEFAULT_CONFIG
};

// Run if called directly
if (require.main === module) {
  main();
}
