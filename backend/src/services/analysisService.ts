import { AnalysisResult } from '../types';
import { generateId } from '../utils/uuid';
import { logger } from '../utils/logger';
import { fetchUrlContent } from './contentFetcher';
import { analyzeContent, MLAnalysisResult } from './mlClient';
import { analysisRepository } from '../database/repositories/analysisRepository';
import { cacheAnalysisResult, getCachedAnalysisResult } from '../cache/cacheService';
import { mongoClient } from '../database/mongoClient';
import { getMetricsService } from '../monitoring/metricsService';

/**
 * Records analysis metrics for monitoring
 * Increments analysis_requests_total counter with input_type label
 * Records score in analysis_score_distribution histogram
 * Requirements: 5.4
 * 
 * @param inputType - The type of input ('url' or 'text')
 * @param status - The status of the analysis ('success' or 'failure')
 * @param score - Optional score to record in histogram (only on success)
 */
function recordAnalysisMetrics(
  inputType: 'url' | 'text',
  status: 'success' | 'failure',
  score?: number
): void {
  try {
    const metrics = getMetricsService();
    
    // Increment analysis requests counter with input_type and status labels
    metrics.analysisRequestsTotal.inc({ input_type: inputType, status });
    
    // Record score in histogram only on success
    if (status === 'success' && score !== undefined) {
      metrics.analysisScoreDistribution.observe(score);
    }
    
    logger.debug('Analysis metrics recorded', { inputType, status, score });
  } catch (error) {
    // Metrics should not break the application - log and continue
    logger.warn('Failed to record analysis metrics', { error, inputType, status });
  }
}

/**
 * Builds a complete AnalysisResult from ML analysis output
 * 
 * @param mlResult - The result from ML service analysis
 * @param inputType - Whether input was 'url' or 'text'
 * @param inputValue - The original input value (URL or text)
 * @param metadata - Optional metadata (title, thumbnail, sourceUrl)
 * @returns Complete AnalysisResult with UUID and timestamp
 */
function buildAnalysisResult(
  mlResult: MLAnalysisResult,
  inputType: 'url' | 'text',
  inputValue: string,
  metadata: {
    title?: string;
    thumbnail?: string;
    sourceUrl?: string;
  } = {}
): AnalysisResult {
  return {
    id: generateId(),
    input: {
      type: inputType,
      value: inputValue,
    },
    score: mlResult.score,
    timestamp: new Date().toISOString(),
    overview: mlResult.overview,
    redFlags: mlResult.redFlags,
    positiveIndicators: mlResult.positiveIndicators,
    keywords: mlResult.keywords,
    metadata,
  };
}

/**
 * Saves analysis result to MongoDB and caches it in Redis
 * Handles failures gracefully - logs warnings but doesn't fail the request
 * Requirements: 4.2, 7.3
 * 
 * @param result - The analysis result to persist
 */
async function persistAnalysisResult(result: AnalysisResult): Promise<void> {
  // Save to MongoDB if connected
  if (mongoClient.isConnected()) {
    try {
      await analysisRepository.save(result);
      logger.info('Analysis result saved to MongoDB', { id: result.id });
    } catch (error) {
      logger.warn('Failed to save analysis result to MongoDB', { id: result.id, error });
      // Continue without failing - graceful degradation
    }
  } else {
    logger.debug('MongoDB not connected, skipping persistence', { id: result.id });
  }

  // Cache in Redis (cacheService handles Redis unavailability gracefully)
  try {
    await cacheAnalysisResult(result);
    logger.debug('Analysis result cached in Redis', { id: result.id });
  } catch (error) {
    logger.warn('Failed to cache analysis result in Redis', { id: result.id, error });
    // Continue without failing - graceful degradation
  }
}

/**
 * Retrieves an analysis result by ID
 * Checks cache first, then falls back to database
 * Requirements: 4.2, 7.3
 * 
 * @param id - The analysis result ID
 * @returns The analysis result or null if not found
 */
export async function getAnalysisById(id: string): Promise<AnalysisResult | null> {
  // Try cache first
  try {
    const cached = await getCachedAnalysisResult(id);
    if (cached) {
      logger.debug('Analysis result retrieved from cache', { id });
      return cached;
    }
  } catch (error) {
    logger.warn('Failed to retrieve from cache', { id, error });
  }

  // Fall back to database
  if (mongoClient.isConnected()) {
    try {
      const result = await analysisRepository.findById(id);
      if (result) {
        // Cache the result for future requests
        await cacheAnalysisResult(result);
        logger.debug('Analysis result retrieved from database', { id });
        return result;
      }
    } catch (error) {
      logger.warn('Failed to retrieve from database', { id, error });
    }
  }

  return null;
}

/**
 * Analyzes content from a URL
 * 
 * Orchestrates the workflow:
 * 1. Fetch content from URL
 * 2. Send content to ML service for analysis
 * 3. Build complete AnalysisResult with metadata
 * 4. Persist to MongoDB and cache in Redis
 * 5. Record metrics for monitoring
 * 
 * @param url - The URL to analyze
 * @returns Complete AnalysisResult with score, red flags, positive indicators, keywords, and metadata
 * @throws FetchError if URL content cannot be fetched
 * @throws MLServiceError if ML service is unavailable
 * @throws TimeoutError if any operation times out
 * 
 * Requirements: 1.1, 3.1, 3.5, 3.6, 4.2, 5.4, 7.3
 */
export async function analyzeUrl(url: string): Promise<AnalysisResult> {
  logger.info('Starting URL analysis', { url });

  try {
    // Step 1: Fetch content from URL
    const fetchedContent = await fetchUrlContent(url);

    logger.info('URL content fetched, sending to ML service', {
      url,
      contentLength: fetchedContent.content.length,
      hasTitle: !!fetchedContent.title,
      hasThumbnail: !!fetchedContent.thumbnail,
    });

    // Step 2: Analyze content with ML service
    const mlResult = await analyzeContent(fetchedContent.content, url);

    // Step 3: Build complete result with metadata
    const result = buildAnalysisResult(mlResult, 'url', url, {
      title: fetchedContent.title,
      thumbnail: fetchedContent.thumbnail,
      sourceUrl: fetchedContent.sourceUrl,
    });

    // Step 4: Persist to MongoDB and cache in Redis
    await persistAnalysisResult(result);

    // Step 5: Record success metrics
    recordAnalysisMetrics('url', 'success', result.score);

    logger.info('URL analysis completed', {
      url,
      analysisId: result.id,
      score: result.score,
    });

    return result;
  } catch (error) {
    // Record failure metrics
    recordAnalysisMetrics('url', 'failure');
    throw error;
  }
}

/**
 * Analyzes raw text content
 * 
 * Sends text directly to ML service for analysis
 * Persists result to MongoDB and caches in Redis
 * Records metrics for monitoring
 * 
 * @param text - The text content to analyze
 * @returns Complete AnalysisResult with score, red flags, positive indicators, and keywords
 * @throws MLServiceError if ML service is unavailable
 * @throws TimeoutError if operation times out
 * 
 * Requirements: 2.1, 3.1, 3.5, 3.6, 4.2, 5.4, 7.3
 */
export async function analyzeText(text: string): Promise<AnalysisResult> {
  logger.info('Starting text analysis', { textLength: text.length });

  try {
    // Analyze content with ML service (no source URL for text input)
    const mlResult = await analyzeContent(text);

    // Build complete result (no metadata for text input)
    const result = buildAnalysisResult(mlResult, 'text', text, {});

    // Persist to MongoDB and cache in Redis
    await persistAnalysisResult(result);

    // Record success metrics
    recordAnalysisMetrics('text', 'success', result.score);

    logger.info('Text analysis completed', {
      analysisId: result.id,
      score: result.score,
    });

    return result;
  } catch (error) {
    // Record failure metrics
    recordAnalysisMetrics('text', 'failure');
    throw error;
  }
}
