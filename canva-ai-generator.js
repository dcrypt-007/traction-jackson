// canva-ai-generator.js - TractionJackson Canva AI Integration
// Generates video designs using Canva AI instead of Brand Templates API

const fs = require('fs');
const path = require('path');

/**
 * Video style presets for different ad types
 */
const VIDEO_STYLES = {
  'tiktok-ad': {
    format: 'TikTok video ad',
    aspectRatio: '9:16 vertical',
    duration: '15-30 seconds',
    style: 'fast-paced, trendy, attention-grabbing'
  },
  'instagram-reel': {
    format: 'Instagram Reel',
    aspectRatio: '9:16 vertical',
    duration: '15-30 seconds',
    style: 'polished, lifestyle-focused, engaging'
  },
  'facebook-ad': {
    format: 'Facebook video ad',
    aspectRatio: '1:1 square or 16:9 horizontal',
    duration: '15-60 seconds',
    style: 'professional, clear messaging, benefit-focused'
  },
  'youtube-short': {
    format: 'YouTube Short',
    aspectRatio: '9:16 vertical',
    duration: '30-60 seconds',
    style: 'educational, hook-driven, value-packed'
  },
  'generic': {
    format: 'video ad',
    aspectRatio: '9:16 vertical',
    duration: '15-30 seconds',
    style: 'professional and engaging'
  }
};

/**
 * Generate a Canva AI prompt from campaign data
 * @param {Object} campaignData - Campaign configuration
 * @returns {string} - Prompt for Canva AI
 */
function generateCanvaPrompt(campaignData) {
  const {
    brand = 'the brand',
    product = 'the product',
    headline,
    hook,
    painPoint,
    solution,
    cta = 'Learn More',
    targetAudience,
    tone = 'professional',
    videoStyle = 'generic',
    colors,
    additionalContext
  } = campaignData;

  const style = VIDEO_STYLES[videoStyle] || VIDEO_STYLES.generic;

  // Build the prompt
  let prompt = `Create a ${style.format} for ${brand}`;

  if (product && product !== 'the product') {
    prompt += ` promoting ${product}`;
  }

  prompt += '.\n\n';

  // Add the hook/headline
  if (hook) {
    prompt += `Opening hook: "${hook}"\n`;
  } else if (headline) {
    prompt += `Main message: "${headline}"\n`;
  }

  // Add pain point and solution structure
  if (painPoint) {
    prompt += `Address this pain point: ${painPoint}\n`;
  }

  if (solution) {
    prompt += `Present this solution: ${solution}\n`;
  }

  // Add CTA
  prompt += `Call to action: "${cta}"\n\n`;

  // Add style guidance
  prompt += `Style: ${style.style}, ${tone} tone\n`;
  prompt += `Format: ${style.aspectRatio}, ${style.duration}\n`;

  // Add target audience context
  if (targetAudience) {
    prompt += `Target audience: ${targetAudience}\n`;
  }

  // Add color preferences
  if (colors && colors.length > 0) {
    prompt += `Brand colors: ${colors.join(', ')}\n`;
  }

  // Add any additional context
  if (additionalContext) {
    prompt += `\nAdditional context: ${additionalContext}`;
  }

  return prompt.trim();
}

/**
 * Generate multiple prompts for A/B testing variations
 * @param {Object} campaignData - Base campaign data
 * @param {Array} variations - Array of variation overrides
 * @returns {Array} - Array of prompts
 */
function generateVariationPrompts(campaignData, variations) {
  return variations.map((variation, index) => {
    const mergedData = { ...campaignData, ...variation };
    return {
      index: index + 1,
      name: variation.name || `Variation ${index + 1}`,
      prompt: generateCanvaPrompt(mergedData),
      data: mergedData
    };
  });
}

/**
 * Extract design ID from Canva URL
 * @param {string} url - Canva design URL
 * @returns {string|null} - Design ID or null
 */
function extractDesignId(url) {
  if (!url) return null;

  // Handle various Canva URL formats:
  // https://www.canva.com/design/DAHAcoItOIY/view
  // https://www.canva.com/design/DAHAcoItOIY?ui=...
  // DAHAcoItOIY (just the ID)

  // If it looks like just an ID (starts with DA)
  if (/^DA[A-Za-z0-9_-]+$/.test(url)) {
    return url;
  }

  // Extract from URL
  const match = url.match(/design\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Pending designs queue - stores prompts waiting for design IDs
 */
class CanvaAIQueue {
  constructor(storePath = './canva-ai-queue.json') {
    this.storePath = storePath;
    this.queue = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.storePath)) {
        return JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      }
    } catch (e) {
      console.error('[TJ] Error loading queue:', e.message);
    }
    return { pending: [], completed: [] };
  }

  save() {
    fs.writeFileSync(this.storePath, JSON.stringify(this.queue, null, 2));
  }

  /**
   * Add a prompt to the queue
   */
  addPending(campaignId, promptData) {
    const item = {
      id: `${campaignId}_${Date.now()}`,
      campaignId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      prompt: promptData.prompt,
      data: promptData.data || promptData,
      designId: null,
      designUrl: null
    };

    this.queue.pending.push(item);
    this.save();

    console.log(`[TJ] Added to queue: ${item.id}`);
    return item;
  }

  /**
   * Mark a pending item as completed with design ID
   */
  complete(itemId, designIdOrUrl) {
    const index = this.queue.pending.findIndex(p => p.id === itemId);
    if (index === -1) {
      throw new Error(`Item not found: ${itemId}`);
    }

    const item = this.queue.pending[index];
    item.designId = extractDesignId(designIdOrUrl);
    item.designUrl = designIdOrUrl.includes('canva.com') ? designIdOrUrl : null;
    item.status = 'completed';
    item.completedAt = new Date().toISOString();

    // Move to completed
    this.queue.completed.push(item);
    this.queue.pending.splice(index, 1);
    this.save();

    console.log(`[TJ] Completed: ${item.id} -> Design: ${item.designId}`);
    return item;
  }

  /**
   * Get all pending items
   */
  getPending() {
    return this.queue.pending;
  }

  /**
   * Get completed items for a campaign
   */
  getCompleted(campaignId) {
    return this.queue.completed.filter(c => c.campaignId === campaignId);
  }

  /**
   * Clear all items
   */
  clear() {
    this.queue = { pending: [], completed: [] };
    this.save();
  }
}

/**
 * Generate prompts for a campaign and return them for Canva AI
 * This is the main entry point for the new flow
 */
async function prepareCampaignPrompts(campaignConfig) {
  const {
    name,
    brand,
    product,
    hooks = [],
    painPoints = [],
    solutions = [],
    cta,
    targetAudience,
    tone,
    videoStyle,
    colors
  } = campaignConfig;

  console.log(`[TJ] Preparing Canva AI prompts for: ${name}`);

  const prompts = [];

  // If hooks are provided, create a variation for each
  if (hooks.length > 0) {
    hooks.forEach((hook, i) => {
      const data = {
        brand,
        product,
        hook,
        painPoint: painPoints[i] || painPoints[0],
        solution: solutions[i] || solutions[0],
        cta,
        targetAudience,
        tone,
        videoStyle,
        colors
      };

      prompts.push({
        name: `Hook ${i + 1}: ${hook.substring(0, 30)}...`,
        prompt: generateCanvaPrompt(data),
        data
      });
    });
  } else if (painPoints.length > 0) {
    // Create variations based on pain points
    painPoints.forEach((painPoint, i) => {
      const data = {
        brand,
        product,
        painPoint,
        solution: solutions[i] || solutions[0],
        cta,
        targetAudience,
        tone,
        videoStyle,
        colors
      };

      prompts.push({
        name: `Pain Point ${i + 1}: ${painPoint.substring(0, 30)}...`,
        prompt: generateCanvaPrompt(data),
        data
      });
    });
  } else {
    // Single prompt
    prompts.push({
      name: 'Main Creative',
      prompt: generateCanvaPrompt(campaignConfig),
      data: campaignConfig
    });
  }

  console.log(`[TJ] Generated ${prompts.length} prompt(s)`);

  return {
    campaignName: name,
    totalPrompts: prompts.length,
    prompts
  };
}

/**
 * Format prompts for display/copying to Canva AI
 */
function formatPromptsForDisplay(promptsResult) {
  let output = `\n${'='.repeat(60)}\n`;
  output += `CANVA AI PROMPTS FOR: ${promptsResult.campaignName}\n`;
  output += `Total variations: ${promptsResult.totalPrompts}\n`;
  output += `${'='.repeat(60)}\n\n`;

  promptsResult.prompts.forEach((p, i) => {
    output += `--- Prompt ${i + 1}: ${p.name} ---\n\n`;
    output += p.prompt;
    output += `\n\n${'─'.repeat(40)}\n\n`;
  });

  return output;
}

// Export everything
module.exports = {
  VIDEO_STYLES,
  generateCanvaPrompt,
  generateVariationPrompts,
  extractDesignId,
  CanvaAIQueue,
  prepareCampaignPrompts,
  formatPromptsForDisplay
};

// CLI test
if (require.main === module) {
  // Example campaign
  const testCampaign = {
    name: 'AI Automation Product Launch',
    brand: 'TractionJackson',
    product: 'AI Video Ad Generator',
    hooks: [
      'Stop wasting hours on video ads...',
      'What if you could create 100 video ads in 10 minutes?',
      'Your competitors are using AI. Are you?'
    ],
    painPoints: [
      'Creating video ads takes too long',
      'Hiring video editors is expensive',
      'You need more ad variations for testing'
    ],
    solutions: [
      'AI generates professional video ads in seconds',
      'No editing skills required - just describe what you want',
      'Generate unlimited variations for A/B testing'
    ],
    cta: 'Try Free for 7 Days',
    targetAudience: 'Marketing managers and small business owners',
    tone: 'confident and innovative',
    videoStyle: 'tiktok-ad',
    colors: ['#7C3AED', '#EC4899', '#F59E0B']
  };

  const result = prepareCampaignPrompts(testCampaign);
  console.log(formatPromptsForDisplay(result));
}
