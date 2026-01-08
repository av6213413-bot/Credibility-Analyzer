/**
 * Analysis Queue
 * 
 * Implements Bull queue for async analysis job processing.
 * Provides job creation, processing, and status tracking.
 * 
 * Requirements: 10.1, 10.4
 */

import { QueueConfig } from './queueConfig';
import { calculateExponentialBackoff } from './backoffUtils';
import { AnalysisResult } from '../types';

/**
 * Job status enum
 */
export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed';

/**
 * Input data for analysis jobs
 */
export interface AnalysisJobInput {
  type: 'url' | 'text';
  value: string;
}

/**
 * Data structure for queued analysis jobs
 */
export interface QueuedJob {
  id: string;
  type: 'analysis';
  data: {
    input: AnalysisJobInput;
    userId?: string;
  };
  status: JobStatus;
  progress: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedReason?: string;
  result?: AnalysisResult;
}

/**
 * Response structure for job status API
 */
export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  progress: number;
  result?: AnalysisResult;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * Job processor function type
 */
export type JobProcessor = (job: QueuedJob) => Promise<AnalysisResult>;

/**
 * In-memory job store for testing and development
 * In production, this would be backed by Redis/Bull
 */
const jobStore = new Map<string, QueuedJob>();

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Analysis Queue class
 * Manages async job processing for analysis requests
 */
export class AnalysisQueue {
  private config: QueueConfig;
  private processor?: JobProcessor;

  constructor(config?: Partial<QueueConfig>) {
    // Create a complete config with defaults
    this.config = {
      type: config?.type || 'bull',
      redis: config?.redis || {
        host: 'localhost',
        port: 6379,
        db: 0,
      },
      rabbitmq: config?.rabbitmq,
      defaultJobOptions: {
        attempts: config?.defaultJobOptions?.attempts || 3,
        backoff: {
          type: config?.defaultJobOptions?.backoff?.type || 'exponential',
          delay: config?.defaultJobOptions?.backoff?.delay || 1000,
        },
        removeOnComplete: config?.defaultJobOptions?.removeOnComplete ?? true,
        removeOnFail: config?.defaultJobOptions?.removeOnFail ?? false,
        timeout: config?.defaultJobOptions?.timeout || 60000,
      },
    };
  }

  /**
   * Add a new analysis job to the queue
   * Returns immediately with a job ID for async tracking
   * 
   * @param input - Analysis input (URL or text)
   * @param userId - Optional user ID for tracking
   * @returns Job ID and initial status
   */
  async addJob(input: AnalysisJobInput, userId?: string): Promise<{ jobId: string; status: JobStatus }> {
    const jobId = generateJobId();
    const now = new Date();

    const job: QueuedJob = {
      id: jobId,
      type: 'analysis',
      data: {
        input,
        userId,
      },
      status: 'waiting',
      progress: 0,
      attempts: 0,
      maxAttempts: this.config.defaultJobOptions.attempts,
      createdAt: now,
    };

    jobStore.set(jobId, job);

    // In a real implementation, this would add to Bull/Redis queue
    // For now, we simulate async processing
    if (this.processor) {
      this.processJobAsync(jobId);
    }

    return { jobId, status: 'waiting' };
  }

  /**
   * Get the current status of a job
   * 
   * @param jobId - Job ID to look up
   * @returns Job status response or null if not found
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse | null> {
    const job = jobStore.get(jobId);
    
    if (!job) {
      return null;
    }

    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.failedReason,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    };
  }

  /**
   * Register a job processor function
   * 
   * @param processor - Function to process analysis jobs
   */
  setProcessor(processor: JobProcessor): void {
    this.processor = processor;
  }

  /**
   * Process a job asynchronously with retry logic
   * 
   * @param jobId - Job ID to process
   */
  private async processJobAsync(jobId: string): Promise<void> {
    const job = jobStore.get(jobId);
    if (!job || !this.processor) return;

    job.status = 'active';
    job.processedAt = new Date();
    job.attempts += 1;

    try {
      const result = await this.processor(job);
      job.status = 'completed';
      job.progress = 100;
      job.result = result;
      job.completedAt = new Date();
    } catch (error) {
      if (job.attempts < job.maxAttempts) {
        // Calculate backoff delay and retry
        const delay = calculateExponentialBackoff(
          this.config.defaultJobOptions.backoff.delay,
          job.attempts
        );
        job.status = 'waiting';
        
        setTimeout(() => this.processJobAsync(jobId), delay);
      } else {
        job.status = 'failed';
        job.failedReason = error instanceof Error ? error.message : 'Unknown error';
        job.completedAt = new Date();
      }
    }

    jobStore.set(jobId, job);
  }

  /**
   * Update job progress
   * 
   * @param jobId - Job ID to update
   * @param progress - Progress percentage (0-100)
   */
  async updateProgress(jobId: string, progress: number): Promise<void> {
    const job = jobStore.get(jobId);
    if (job) {
      job.progress = Math.min(100, Math.max(0, progress));
      jobStore.set(jobId, job);
    }
  }

  /**
   * Get all jobs (for testing/debugging)
   */
  getAllJobs(): QueuedJob[] {
    return Array.from(jobStore.values());
  }

  /**
   * Clear all jobs (for testing)
   */
  clearJobs(): void {
    jobStore.clear();
  }

  /**
   * Get a job by ID (for testing)
   */
  getJob(jobId: string): QueuedJob | undefined {
    return jobStore.get(jobId);
  }
}

/**
 * Default analysis queue instance
 */
export const analysisQueue = new AnalysisQueue();
