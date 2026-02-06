// ffmpeg-merge.js - Merge video and audio into single MP4 for TractionJackson
// TASK-003: Audio/Video Merge Pipeline

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Get ffmpeg binary path
 * Tries: 1) ffmpeg-static, 2) system ffmpeg
 */
function getFfmpegPath() {
  try {
    // Try ffmpeg-static first (bundled binary)
    return require('ffmpeg-static');
  } catch (e) {
    // Fall back to system ffmpeg
    return 'ffmpeg';
  }
}

/**
 * Check if ffmpeg is available
 */
async function checkFfmpeg() {
  return new Promise((resolve) => {
    const ffmpeg = spawn(getFfmpegPath(), ['-version']);

    ffmpeg.on('error', () => resolve(false));
    ffmpeg.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Get video duration using ffprobe
 */
async function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    const ffprobePath = getFfmpegPath().replace('ffmpeg', 'ffprobe');

    const ffprobe = spawn(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => output += data);
    ffprobe.stderr.on('data', (data) => console.error('[ffprobe]', data.toString()));

    ffprobe.on('close', (code) => {
      if (code === 0) {
        resolve(parseFloat(output.trim()));
      } else {
        // If ffprobe fails, return null (we'll skip duration check)
        resolve(null);
      }
    });

    ffprobe.on('error', () => resolve(null));
  });
}

/**
 * Get audio duration
 */
async function getAudioDuration(audioPath) {
  return getVideoDuration(audioPath); // Same method works for audio
}

/**
 * Merge video and audio into a single MP4
 *
 * @param {string} videoPath - Path to the video file (from Canva)
 * @param {string} audioPath - Path to the audio file (from ElevenLabs)
 * @param {object} options - Merge options
 * @returns {Promise<object>} - Result with output path and metadata
 */
async function mergeVideoAudio(videoPath, audioPath, options = {}) {
  const {
    outputPath = null,
    outputDir = null,
    filename = null,
    overwrite = true,
    audioVolume = 1.0,      // Volume multiplier (0.0 - 2.0)
    fadeIn = 0.5,           // Audio fade in duration (seconds)
    fadeOut = 0.5,          // Audio fade out duration (seconds)
    normalizeAudio = true,  // Normalize audio levels
    keepOriginalAudio = false  // Mix with original video audio (if any)
  } = options;

  // Validate inputs
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  // Check ffmpeg availability
  const ffmpegAvailable = await checkFfmpeg();
  if (!ffmpegAvailable) {
    throw new Error('ffmpeg not found. Install with: npm install ffmpeg-static');
  }

  // Determine output path
  let finalOutputPath = outputPath;
  if (!finalOutputPath) {
    const videoName = path.basename(videoPath, path.extname(videoPath));
    const outFilename = filename || `${videoName}_merged.mp4`;
    const outDir = outputDir || path.dirname(videoPath);
    finalOutputPath = path.join(outDir, outFilename);
  }

  console.log(`[TJ] Merging video + audio...`);
  console.log(`[TJ]   Video: ${path.basename(videoPath)}`);
  console.log(`[TJ]   Audio: ${path.basename(audioPath)}`);
  console.log(`[TJ]   Output: ${path.basename(finalOutputPath)}`);

  // Get durations for metadata
  const videoDuration = await getVideoDuration(videoPath);
  const audioDuration = await getAudioDuration(audioPath);

  console.log(`[TJ]   Video duration: ${videoDuration?.toFixed(2) || 'unknown'}s`);
  console.log(`[TJ]   Audio duration: ${audioDuration?.toFixed(2) || 'unknown'}s`);

  // Build ffmpeg arguments
  const args = [];

  // Overwrite output if exists
  if (overwrite) {
    args.push('-y');
  }

  // Input files
  args.push('-i', videoPath);
  args.push('-i', audioPath);

  // Build audio filter chain
  const audioFilters = [];

  // Volume adjustment
  if (audioVolume !== 1.0) {
    audioFilters.push(`volume=${audioVolume}`);
  }

  // Audio normalization
  if (normalizeAudio) {
    audioFilters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
  }

  // Fade effects (if we know audio duration)
  if (audioDuration && (fadeIn > 0 || fadeOut > 0)) {
    if (fadeIn > 0) {
      audioFilters.push(`afade=t=in:st=0:d=${fadeIn}`);
    }
    if (fadeOut > 0) {
      const fadeOutStart = Math.max(0, audioDuration - fadeOut);
      audioFilters.push(`afade=t=out:st=${fadeOutStart}:d=${fadeOut}`);
    }
  }

  // Map video from first input, audio from second
  args.push('-map', '0:v:0');  // Video from input 0

  if (keepOriginalAudio) {
    // Mix original audio with new voiceover
    args.push('-filter_complex', `[0:a][1:a]amix=inputs=2:duration=first[aout]`);
    args.push('-map', '[aout]');
  } else {
    // Replace audio entirely
    args.push('-map', '1:a:0');  // Audio from input 1
  }

  // Apply audio filters if any
  if (audioFilters.length > 0 && !keepOriginalAudio) {
    args.push('-af', audioFilters.join(','));
  }

  // Output settings
  args.push('-c:v', 'copy');        // Copy video codec (fast, no re-encoding)
  args.push('-c:a', 'aac');         // AAC audio codec
  args.push('-b:a', '192k');        // Audio bitrate
  args.push('-shortest');           // Match shortest stream duration
  args.push('-movflags', '+faststart');  // Web optimization

  args.push(finalOutputPath);

  // Run ffmpeg
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(getFfmpegPath(), args);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      // Log progress (ffmpeg outputs to stderr)
      const progressMatch = data.toString().match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
      if (progressMatch) {
        process.stdout.write(`\r[TJ] Progress: ${progressMatch[1]}`);
      }
    });

    ffmpeg.on('close', (code) => {
      console.log(''); // New line after progress

      if (code === 0) {
        // Get output file size
        const stats = fs.statSync(finalOutputPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log(`[TJ] Merge complete! Output: ${fileSizeMB} MB`);

        resolve({
          success: true,
          outputPath: finalOutputPath,
          metadata: {
            videoDuration,
            audioDuration,
            fileSizeMB: parseFloat(fileSizeMB),
            videoSource: videoPath,
            audioSource: audioPath
          }
        });
      } else {
        console.error('[TJ] ffmpeg error:', stderr.slice(-500));
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`ffmpeg spawn error: ${err.message}`));
    });
  });
}

/**
 * Batch merge multiple video/audio pairs
 */
async function batchMerge(pairs, options = {}) {
  console.log(`[TJ] Batch merging ${pairs.length} video/audio pairs...`);

  const results = [];

  for (let i = 0; i < pairs.length; i++) {
    const { videoPath, audioPath, outputFilename } = pairs[i];
    console.log(`\n[TJ] Merging ${i + 1}/${pairs.length}...`);

    try {
      const result = await mergeVideoAudio(videoPath, audioPath, {
        ...options,
        filename: outputFilename
      });
      results.push(result);
    } catch (error) {
      console.error(`[TJ] Merge failed for pair ${i + 1}:`, error.message);
      results.push({
        success: false,
        error: error.message,
        videoPath,
        audioPath
      });
    }
  }

  const successful = results.filter(r => r.success).length;
  console.log(`\n[TJ] Batch merge complete: ${successful}/${pairs.length} successful`);

  return results;
}

// ============ CLI Runner ============
async function main() {
  const videoPath = process.argv[2];
  const audioPath = process.argv[3];
  const outputPath = process.argv[4];

  if (!videoPath || !audioPath) {
    console.log('Usage: node ffmpeg-merge.js <video.mp4> <audio.mp3> [output.mp4]');
    console.log('\nOptions via environment:');
    console.log('  AUDIO_VOLUME=1.0    Volume multiplier (0.0-2.0)');
    console.log('  FADE_IN=0.5         Audio fade in seconds');
    console.log('  FADE_OUT=0.5        Audio fade out seconds');
    process.exit(1);
  }

  try {
    const result = await mergeVideoAudio(videoPath, audioPath, {
      outputPath,
      audioVolume: parseFloat(process.env.AUDIO_VOLUME || '1.0'),
      fadeIn: parseFloat(process.env.FADE_IN || '0.5'),
      fadeOut: parseFloat(process.env.FADE_OUT || '0.5')
    });

    console.log('\n=== MERGE RESULT ===');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('[TJ] Error:', error.message);
    process.exit(1);
  }
}

// Export for module use
module.exports = {
  mergeVideoAudio,
  batchMerge,
  checkFfmpeg,
  getVideoDuration,
  getAudioDuration,
  getFfmpegPath
};

// Run if called directly
if (require.main === module) {
  main();
}
