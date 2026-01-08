import { Router } from 'express';
import { handleAnalyzeUrl, handleAnalyzeText } from '../controllers/analysisController';
import { validateUrlRequest, validateTextRequest, validateContentType } from '../middleware/validation';

/**
 * Analysis routes for credibility analysis endpoints
 * 
 * Routes:
 * - POST /api/analyze/url - Analyze content from a URL
 * - POST /api/analyze/text - Analyze raw text content
 * 
 * Requirements: 1.1, 2.1
 */
const router = Router();

/**
 * POST /api/analyze/url
 * 
 * Analyzes content from a provided URL.
 * Validates Content-Type and URL format before processing.
 * 
 * Request body: { url: string }
 * Response: AnalysisResult
 * 
 * Requirements: 1.1
 */
router.post(
  '/url',
  validateContentType,
  validateUrlRequest,
  handleAnalyzeUrl
);

/**
 * POST /api/analyze/text
 * 
 * Analyzes raw text content.
 * Validates Content-Type and text format before processing.
 * 
 * Request body: { text: string }
 * Response: AnalysisResult
 * 
 * Requirements: 2.1
 */
router.post(
  '/text',
  validateContentType,
  validateTextRequest,
  handleAnalyzeText
);

export { router as analysisRoutes };
