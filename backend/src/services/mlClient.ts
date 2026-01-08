import axios, { AxiosError } from 'axios';
import { MLServiceError, TimeoutError } from '../middleware/errorHandler';
import { config } from '../config';
import { logger } from '../utils/logger';
import { RedFlag, PositiveIndicator, Keyword } from '../types';

/**
 * Response from the ML service /analyze endpoint
 */
export interface MLAnalysisResponse {
  score: number;
  overview: string;
  red_flags: Array<{
    id: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  positive_indicators: Array<{
    id: string;
    description: string;
    icon: string;
  }>;
  keywords: Array<{
    term: string;
    impact: 'positive' | 'negative';
    weight: number;
  }>;
}

/**
 * Transformed analysis result from ML service
 */
export interface MLAnalysisResult {
  score: number;
  overview: string;
  redFlags: RedFlag[];
  positiveIndicators: PositiveIndicator[];
  keywords: Keyword[];
}

/** Default timeout for ML service calls in milliseconds */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Transforms ML service response (snake_case) to API format (camelCase)
 */
function transformMLResponse(response: MLAnalysisResponse): MLAnalysisResult {
  return {
    score: response.score,
    overview: response.overview,
    redFlags: response.red_flags.map((flag) => ({
      id: flag.id,
      description: flag.description,
      severity: flag.severity,
    })),
    positiveIndicators: response.positive_indicators.map((indicator) => ({
      id: indicator.id,
      description: indicator.description,
      icon: indicator.icon,
    })),
    keywords: response.keywords.map((keyword) => ({
      term: keyword.term,
      impact: keyword.impact,
      weight: keyword.weight,
    })),
  };
}


/**
 * Analyzes content using the ML service
 * 
 * @param text - The text content to analyze
 * @param sourceUrl - Optional source URL for context
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns MLAnalysisResult with score, overview, red flags, positive indicators, and keywords
 * @throws MLServiceError if the ML service is unavailable or returns an error
 * @throws TimeoutError if the request exceeds the timeout
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.5
 */
export async function analyzeContent(
  text: string,
  sourceUrl?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<MLAnalysisResult> {
  const mlServiceUrl = `${config.mlServiceUrl}/analyze`;
  
  // Create AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    logger.info('Calling ML service for content analysis', {
      textLength: text.length,
      sourceUrl: sourceUrl || 'none',
      mlServiceUrl,
    });

    const response = await axios.post<MLAnalysisResponse>(
      mlServiceUrl,
      {
        text,
        source_url: sourceUrl || null,
      },
      {
        signal: controller.signal,
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
        },
        // Validate status codes
        validateStatus: (status) => status >= 200 && status < 300,
      }
    );

    const result = transformMLResponse(response.data);

    logger.info('ML service analysis completed', {
      score: result.score,
      redFlagsCount: result.redFlags.length,
      positiveIndicatorsCount: result.positiveIndicators.length,
      keywordsCount: result.keywords.length,
    });

    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort/timeout
    if (axios.isCancel(error) || (error instanceof Error && error.name === 'AbortError')) {
      logger.warn('ML service request timed out', { timeoutMs });
      throw new TimeoutError(`ML service request timed out after ${timeoutMs}ms`);
    }

    // Handle Axios errors
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const statusText = error.response?.statusText || 'Unknown error';

      logger.warn('ML service request failed', {
        status,
        statusText,
        code: error.code,
        message: error.message,
      });

      // Handle connection errors (service unavailable)
      if (error.code === 'ECONNREFUSED') {
        throw new MLServiceError(
          'ML service is not available',
          'The analysis service is currently offline. Please try again later'
        );
      }

      if (error.code === 'ENOTFOUND') {
        throw new MLServiceError(
          'ML service host not found',
          'The analysis service cannot be reached. Please try again later'
        );
      }

      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        throw new TimeoutError('ML service request timed out');
      }

      // Handle HTTP errors from ML service
      if (status && status >= 500) {
        throw new MLServiceError(
          `ML service error: ${statusText}`,
          'The analysis service encountered an error. Please try again later'
        );
      }

      if (status === 400) {
        throw new MLServiceError(
          `ML service rejected the request: ${error.response?.data?.message || statusText}`,
          'The content could not be analyzed. Please try different content'
        );
      }

      // Generic ML service error
      throw new MLServiceError(
        `ML service error: ${error.message}`,
        'Please try again in a few moments'
      );
    }

    // Re-throw if it's already our custom error
    if (error instanceof MLServiceError || error instanceof TimeoutError) {
      throw error;
    }

    // Unknown error
    logger.error('Unexpected error calling ML service', { error });
    throw new MLServiceError(
      'Unexpected error communicating with ML service',
      'Please try again or contact support if the issue persists'
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Checks if the ML service is available
 * Used for health/readiness checks
 * 
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns true if ML service is reachable, false otherwise
 */
export async function isMLServiceAvailable(timeoutMs: number = 5000): Promise<boolean> {
  try {
    const healthUrl = `${config.mlServiceUrl}/health`;
    
    await axios.get(healthUrl, {
      timeout: timeoutMs,
      validateStatus: (status) => status >= 200 && status < 300,
    });
    
    return true;
  } catch {
    logger.warn('ML service health check failed');
    return false;
  }
}
