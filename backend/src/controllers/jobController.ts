/**
 * Job Controller
 * 
 * Handles job status API endpoints for async job processing.
 * Provides job status, progress, and result retrieval.
 * 
 * Requirements: 10.6
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { analysisQueue, JobStatusResponse } from '../queue';
import { logger } from '../utils/logger';

/**
 * Controller for handling job status requests
 * 
 * Retrieves the current status of a job by ID.
 * Returns job status, progress, result (if completed), and error (if failed).
 * 
 * @route GET /api/jobs/:id
 * @param req - Express request with job ID param
 * @param res - Express response
 * 
 * Requirements: 10.6
 */
export const handleGetJobStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    logger.info('Received job status request', { jobId: id });

    const jobStatus = await analysisQueue.getJobStatus(id);

    if (!jobStatus) {
      logger.warn('Job not found', { jobId: id });
      res.status(404).json({
        code: 'JOB_NOT_FOUND',
        message: `Job with ID '${id}' was not found`,
      });
      return;
    }

    logger.info('Job status retrieved successfully', {
      jobId: id,
      status: jobStatus.status,
      progress: jobStatus.progress,
    });

    res.status(200).json(jobStatus);
  }
);

/**
 * Validates that a job status response contains all required fields
 * Used for testing and validation purposes
 * 
 * @param response - Job status response to validate
 * @returns true if valid, false otherwise
 */
export function isValidJobStatusResponse(response: unknown): response is JobStatusResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const r = response as Record<string, unknown>;

  // Check required fields
  if (typeof r.jobId !== 'string') return false;
  if (!['waiting', 'active', 'completed', 'failed'].includes(r.status as string)) return false;
  if (typeof r.progress !== 'number' || r.progress < 0 || r.progress > 100) return false;
  if (typeof r.createdAt !== 'string') return false;

  // Validate ISO date format for createdAt
  const createdAtDate = new Date(r.createdAt as string);
  if (isNaN(createdAtDate.getTime())) return false;

  // Optional completedAt must be valid ISO date if present
  if (r.completedAt !== undefined) {
    if (typeof r.completedAt !== 'string') return false;
    const completedAtDate = new Date(r.completedAt as string);
    if (isNaN(completedAtDate.getTime())) return false;
  }

  return true;
}
