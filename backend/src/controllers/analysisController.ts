import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { analyzeUrl, analyzeText } from '../services/analysisService';
import { AnalyzeUrlRequest, AnalyzeTextRequest } from '../types';
import { logger } from '../utils/logger';

/**
 * Controller for handling URL analysis requests
 * 
 * Receives a URL, orchestrates the analysis workflow, and returns the result.
 * Validation is handled by middleware before this controller is called.
 * 
 * @route POST /api/analyze/url
 * @param req - Express request with AnalyzeUrlRequest body
 * @param res - Express response
 * 
 * Requirements: 1.1
 */
export const handleAnalyzeUrl = asyncHandler(
  async (req: Request<object, object, AnalyzeUrlRequest>, res: Response): Promise<void> => {
    const { url } = req.body;

    logger.info('Received URL analysis request', { url });

    const result = await analyzeUrl(url);

    logger.info('URL analysis completed successfully', {
      analysisId: result.id,
      url,
      score: result.score,
    });

    res.status(200).json(result);
  }
);

/**
 * Controller for handling text analysis requests
 * 
 * Receives raw text, sends it for analysis, and returns the result.
 * Validation is handled by middleware before this controller is called.
 * 
 * @route POST /api/analyze/text
 * @param req - Express request with AnalyzeTextRequest body
 * @param res - Express response
 * 
 * Requirements: 2.1
 */
export const handleAnalyzeText = asyncHandler(
  async (req: Request<object, object, AnalyzeTextRequest>, res: Response): Promise<void> => {
    const { text } = req.body;

    logger.info('Received text analysis request', { textLength: text.length });

    const result = await analyzeText(text);

    logger.info('Text analysis completed successfully', {
      analysisId: result.id,
      score: result.score,
    });

    res.status(200).json(result);
  }
);
