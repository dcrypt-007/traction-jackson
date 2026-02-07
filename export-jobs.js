// export-jobs.js - Async Export Job Manager for TractionJackson
// Handles job queue, status tracking, and async Canva exports

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Job statuses
 */
const JobStatus = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Export Job Manager
 * Manages async export jobs with in-memory storage + optional file persistence
 */
class ExportJobManager {
  constructor(options = {}) {
    this.jobs = new Map();
    this.persistPath = options.persistPath || null;
    this.maxJobAge = options.maxJobAge || 24 * 60 * 60 * 1000; // 24 hours
    this.exportTimeout = options.exportTimeout || 120000; // 2 minutes

    // Load persisted jobs if file exists
    if (this.persistPath) {
      this.loadFromFile();
    }

    // Cleanup old jobs every hour
    setInterval(() => this.cleanupOldJobs(), 60 * 60 * 1000);
  }

  /**
   * Generate a unique job ID
   */
  generateJobId() {
    return `exp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Create a new export job
   */
  createJob(designId, campaignName = 'export') {
    const jobId = this.generateJobId();
    const job = {
      jobId,
      designId,
      campaignName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: JobStatus.QUEUED,
      progress: 0,
      downloadUrls: null,
      thumbnailUrl: null,
      error: null
    };

    this.jobs.set(jobId, job);
    this.persist();

    console.log(`[ExportJobs] Created job ${jobId} for design ${designId}`);
    return job;
  }

  /**
   * Get a job by ID
   */
  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Update job status
   */
  updateJob(jobId, updates) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    Object.assign(job, updates, { updatedAt: new Date().toISOString() });
    this.jobs.set(jobId, job);
    this.persist();

    console.log(`[ExportJobs] Updated job ${jobId}: status=${job.status}`);
    return job;
  }

  /**
   * Mark job as processing
   */
  startProcessing(jobId) {
    return this.updateJob(jobId, {
      status: JobStatus.PROCESSING,
      progress: 10
    });
  }

  /**
   * Mark job as completed with download URLs
   */
  completeJob(jobId, downloadUrls, thumbnailUrl = null) {
    return this.updateJob(jobId, {
      status: JobStatus.COMPLETED,
      progress: 100,
      downloadUrls: Array.isArray(downloadUrls) ? downloadUrls : [downloadUrls],
      thumbnailUrl
    });
  }

  /**
   * Mark job as failed
   */
  failJob(jobId, error) {
    return this.updateJob(jobId, {
      status: JobStatus.FAILED,
      error: typeof error === 'string' ? error : error.message
    });
  }

  /**
   * Get all jobs (optionally filtered by status)
   */
  getAllJobs(status = null) {
    const jobs = Array.from(this.jobs.values());
    if (status) {
      return jobs.filter(j => j.status === status);
    }
    return jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Process an export job asynchronously
   * This is the main export logic - runs in background
   */
  async processJob(jobId, canvaToken, exportFn) {
    const job = this.getJob(jobId);
    if (!job) {
      console.error(`[ExportJobs] Job not found: ${jobId}`);
      return;
    }

    try {
      this.startProcessing(jobId);

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Export timed out after 2 minutes')), this.exportTimeout);
      });

      // Create export promise
      const exportPromise = exportFn(canvaToken, job.designId, job.campaignName);

      // Race between export and timeout
      const result = await Promise.race([exportPromise, timeoutPromise]);

      if (result && result.downloadUrls) {
        this.completeJob(jobId, result.downloadUrls, result.thumbnailUrl);
      } else {
        this.failJob(jobId, 'Export completed but no download URLs returned');
      }

    } catch (error) {
      console.error(`[ExportJobs] Job ${jobId} failed:`, error.message);
      this.failJob(jobId, error.message);
    }
  }

  /**
   * Cleanup old jobs
   */
  cleanupOldJobs() {
    const cutoff = Date.now() - this.maxJobAge;
    let removed = 0;

    for (const [jobId, job] of this.jobs) {
      if (new Date(job.createdAt).getTime() < cutoff) {
        this.jobs.delete(jobId);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[ExportJobs] Cleaned up ${removed} old jobs`);
      this.persist();
    }
  }

  /**
   * Persist jobs to file
   */
  persist() {
    if (!this.persistPath) return;

    try {
      const data = JSON.stringify(Array.from(this.jobs.entries()), null, 2);
      fs.writeFileSync(this.persistPath, data);
    } catch (error) {
      console.error('[ExportJobs] Failed to persist:', error.message);
    }
  }

  /**
   * Load jobs from file
   */
  loadFromFile() {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return;

    try {
      const data = fs.readFileSync(this.persistPath, 'utf8');
      const entries = JSON.parse(data);
      this.jobs = new Map(entries);
      console.log(`[ExportJobs] Loaded ${this.jobs.size} jobs from file`);
    } catch (error) {
      console.error('[ExportJobs] Failed to load:', error.message);
    }
  }
}

/**
 * Create the CDN-only export function that calls Canva API
 * Returns Canva CDN URLs directly - no server-side file downloads
 * This is the stable, preferred approach
 */
function createCanvaExporter(exportCDNOnly) {
  return async function exportDesign(canvaToken, designId, campaignName) {
    console.log(`[CanvaExporter] CDN export for design ${designId}`);

    // Export video - CDN only, no local downloads
    const exportResult = await exportCDNOnly(
      canvaToken,
      designId,
      {
        format: 'mp4',
        quality: 'horizontal_1080p'
      }
    );

    if (!exportResult.urls || exportResult.urls.length === 0) {
      throw new Error('No CDN URLs returned from export');
    }

    console.log(`[CanvaExporter] Got ${exportResult.urls.length} CDN URL(s)`);

    // Return CDN URLs directly - UI will stream from Canva CDN
    return {
      downloadUrls: exportResult.urls,
      thumbnailUrl: null  // Thumbnail can be fetched separately if needed
    };
  };
}

module.exports = {
  JobStatus,
  ExportJobManager,
  createCanvaExporter
};
