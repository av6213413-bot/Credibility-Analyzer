/**
 * Job Routes
 * 
 * Routes for async job status tracking and management.
 * 
 * Routes:
 * - GET /api/jobs/:id - Get job status by ID
 * 
 * Requirements: 10.6
 */

import { Router } from 'express';
import { handleGetJobStatus } from '../controllers/jobController';

const router = Router();

/**
 * GET /api/jobs/:id
 * 
 * Retrieves the status of an async job by its ID.
 * Returns job status, progress, result (if completed), and error (if failed).
 * 
 * Response: JobStatusResponse
 * - jobId: string - The job identifier
 * - status: 'waiting' | 'active' | 'completed' | 'failed'
 * - progress: number (0-100)
 * - result?: AnalysisResult (when completed)
 * - error?: string (when failed)
 * - createdAt: string (ISO date)
 * - completedAt?: string (ISO date, when completed or failed)
 * 
 * Error responses:
 * - 404: Job not found
 * 
 * Requirements: 10.6
 */
router.get('/:id', handleGetJobStatus);

export { router as jobRoutes };
