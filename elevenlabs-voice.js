// elevenlabs-voice.js - 11Labs AI Voiceover Integration for TractionJackson
const https = require('https');
const fs = require('fs');
const path = require('path');

const ELEVENLABS_API_BASE = 'api.elevenlabs.io';

/**
 * Make request to ElevenLabs API
 */
function elevenLabsRequest(endpoint, apiKey, method = 'GET', body = null, isStream = false) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: ELEVENLABS_API_BASE,
      path: endpoint,
      method: method,
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    };

    if (isStream) {
      options.headers['Accept'] = 'audio/mpeg';
    }

    const req = https.request(options, (res) => {
      if (isStream && res.statusCode === 200) {
        // Return the stream directly for audio
        resolve(res);
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[11Labs] ${method} ${endpoint} → ${res.statusCode}`);
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            console.error('[11Labs] Error:', parsed);
            reject(new Error(parsed.detail?.message || parsed.message || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
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
 * Get list of available voices
 */
async function listVoices(apiKey) {
  console.log('[TJ] Fetching available voices...');
  const response = await elevenLabsRequest('/v1/voices', apiKey);
  return response.voices;
}

/**
 * Get a specific voice by ID
 */
async function getVoice(apiKey, voiceId) {
  return elevenLabsRequest(`/v1/voices/${voiceId}`, apiKey);
}

/**
 * Generate speech from text and save to file
 */
async function textToSpeech(apiKey, options) {
  const {
    text,
    voiceId = 'EXAVITQu4vr4xnSDxMaL',  // Default: "Sarah" - clear, professional
    modelId = 'eleven_multilingual_v2',   // Best quality model
    outputPath,
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0.0,
    useSpeakerBoost = true
  } = options;

  console.log(`[TJ] Generating voiceover (${text.length} chars)...`);
  console.log(`[TJ] Voice: ${voiceId}, Model: ${modelId}`);

  const body = {
    text: text,
    model_id: modelId,
    voice_settings: {
      stability: stability,
      similarity_boost: similarityBoost,
      style: style,
      use_speaker_boost: useSpeakerBoost
    }
  };

  const stream = await elevenLabsRequest(
    `/v1/text-to-speech/${voiceId}`,
    apiKey,
    'POST',
    body,
    true  // isStream
  );

  // Save audio to file
  const filePath = outputPath || path.join(process.cwd(), `voiceover_${Date.now()}.mp3`);

  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(filePath);

    stream.pipe(fileStream);

    fileStream.on('finish', () => {
      console.log(`[TJ] Voiceover saved: ${filePath}`);
      resolve({
        success: true,
        filePath: filePath,
        textLength: text.length
      });
    });

    fileStream.on('error', reject);
  });
}

/**
 * Generate voiceover with timing for video sync
 * Returns audio file + estimated duration
 */
async function generateVideoVoiceover(apiKey, script, options = {}) {
  const {
    voiceId = 'EXAVITQu4vr4xnSDxMaL',
    outputDir = process.cwd(),
    prefix = 'tj_vo'
  } = options;

  // Estimate duration: ~150 words per minute for clear speech
  const wordCount = script.split(/\s+/).length;
  const estimatedDuration = (wordCount / 150) * 60;  // seconds

  const timestamp = Date.now();
  const outputPath = path.join(outputDir, `${prefix}_${timestamp}.mp3`);

  const result = await textToSpeech(apiKey, {
    text: script,
    voiceId: voiceId,
    outputPath: outputPath
  });

  return {
    ...result,
    script: script,
    wordCount: wordCount,
    estimatedDuration: estimatedDuration,
    voiceId: voiceId
  };
}

/**
 * Generate multiple voiceovers for A/B testing
 */
async function batchGenerateVoiceovers(apiKey, scripts, options = {}) {
  console.log(`[TJ] Batch generating ${scripts.length} voiceovers...`);

  const results = [];

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    console.log(`[TJ] Generating voiceover ${i + 1}/${scripts.length}...`);

    try {
      const result = await generateVideoVoiceover(apiKey, script, {
        ...options,
        prefix: `tj_vo_${i + 1}`
      });
      results.push({
        success: true,
        index: i + 1,
        ...result
      });
    } catch (error) {
      console.error(`[TJ] Voiceover ${i + 1} failed:`, error.message);
      results.push({
        success: false,
        index: i + 1,
        script: script,
        error: error.message
      });
    }

    // Small delay between requests
    if (i < scripts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const successful = results.filter(r => r.success).length;
  console.log(`[TJ] Batch complete: ${successful}/${scripts.length} successful`);

  return results;
}

/**
 * Recommended voices for video ads
 */
const RECOMMENDED_VOICES = {
  // Professional & Clear
  sarah: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', style: 'Professional female' },
  charlie: { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', style: 'Professional male' },

  // Energetic & Engaging
  matilda: { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', style: 'Warm female' },
  george: { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', style: 'Warm male' },

  // Conversational
  emily: { id: 'LcfcDJNUP1GQjkzn1xUU', name: 'Emily', style: 'Casual female' },
  ethan: { id: 'g5CIjZEefAph4nQFvHAz', name: 'Ethan', style: 'Casual male' }
};

/**
 * Display available voices nicely
 */
function displayVoices(voices) {
  console.log('\n=== AVAILABLE VOICES ===\n');

  voices.forEach((voice, i) => {
    console.log(`${i + 1}. ${voice.name}`);
    console.log(`   ID: ${voice.voice_id}`);
    console.log(`   Labels: ${JSON.stringify(voice.labels || {})}`);
    console.log(`   Preview: ${voice.preview_url || 'N/A'}`);
    console.log('');
  });
}

// ============ CLI Runner ============
async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY || process.argv[2];
  const command = process.argv[3] || 'voices';
  const textArg = process.argv[4];

  if (!apiKey) {
    console.error('Usage: ELEVENLABS_API_KEY=xxx node elevenlabs-voice.js [command] [text]');
    console.error('Commands:');
    console.error('  voices  - List available voices');
    console.error('  speak   - Generate speech (provide text as 4th arg)');
    console.error('  test    - Generate test voiceover');
    process.exit(1);
  }

  try {
    switch (command) {
      case 'voices':
        const voices = await listVoices(apiKey);
        displayVoices(voices);
        break;

      case 'speak':
        if (!textArg) {
          console.error('Please provide text to speak');
          process.exit(1);
        }
        const result = await generateVideoVoiceover(apiKey, textArg);
        console.log('\n=== RESULT ===');
        console.log(JSON.stringify(result, null, 2));
        break;

      case 'test':
        const testScript = "Transform your business with the power of AI. Get started today and see results in just 24 hours.";
        const testResult = await generateVideoVoiceover(apiKey, testScript);
        console.log('\n=== TEST RESULT ===');
        console.log(JSON.stringify(testResult, null, 2));
        break;

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }

  } catch (error) {
    console.error('[TJ] Error:', error.message);
    process.exit(1);
  }
}

// Export for module use
module.exports = {
  listVoices,
  getVoice,
  textToSpeech,
  generateVideoVoiceover,
  batchGenerateVoiceovers,
  RECOMMENDED_VOICES
};

// Run if called directly
if (require.main === module) {
  main();
}
