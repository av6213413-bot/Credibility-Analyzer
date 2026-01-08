import { post } from './apiClient';
import type { AnalysisResult, AnalysisStage } from '@/types';

// API endpoints
const ENDPOINTS = {
  ANALYZE_URL: '/api/analyze/url',
  ANALYZE_TEXT: '/api/analyze/text',
};

/**
 * Callback type for stage progression updates
 */
export type StageProgressCallback = (stage: AnalysisStage) => void;

/**
 * Options for analysis requests
 */
interface AnalysisOptions {
  signal?: AbortSignal;
  onStageChange?: StageProgressCallback;
}

/**
 * Simulates stage progression during analysis
 * In a real implementation, this would be driven by server-sent events or polling
 */
const simulateStageProgression = async (
  onStageChange?: StageProgressCallback,
  signal?: AbortSignal
): Promise<void> => {
  const stages: AnalysisStage[] = ['fetching', 'processing', 'analyzing', 'generating'];
  const stageDelay = 500; // ms per stage

  for (const stage of stages) {
    if (signal?.aborted) {
      throw new DOMException('Analysis was cancelled', 'AbortError');
    }
    onStageChange?.(stage);
    await new Promise((resolve) => setTimeout(resolve, stageDelay));
  }
};

/**
 * Analyzes a URL for credibility
 * @param url - The URL to analyze
 * @param options - Optional configuration including abort signal and stage callback
 * @returns Promise resolving to the analysis result
 */
const analyzeUrl = async (
  url: string,
  options?: AnalysisOptions
): Promise<AnalysisResult> => {
  const { signal, onStageChange } = options || {};

  // Start stage progression simulation
  const stagePromise = simulateStageProgression(onStageChange, signal);

  // Make the API request
  const resultPromise = post<AnalysisResult>(
    ENDPOINTS.ANALYZE_URL,
    { url },
    { signal }
  );

  // Wait for both stage simulation and API response
  const [, result] = await Promise.all([stagePromise, resultPromise]);

  // Ensure timestamp is a Date object
  return {
    ...result,
    timestamp: new Date(result.timestamp),
  };
};

/**
 * Analyzes text content for credibility
 * @param text - The text content to analyze
 * @param options - Optional configuration including abort signal and stage callback
 * @returns Promise resolving to the analysis result
 */
const analyzeText = async (
  text: string,
  options?: AnalysisOptions
): Promise<AnalysisResult> => {
  const { signal, onStageChange } = options || {};

  // Start stage progression simulation
  const stagePromise = simulateStageProgression(onStageChange, signal);

  // Make the API request
  const resultPromise = post<AnalysisResult>(
    ENDPOINTS.ANALYZE_TEXT,
    { text },
    { signal }
  );

  // Wait for both stage simulation and API response
  const [, result] = await Promise.all([stagePromise, resultPromise]);

  // Ensure timestamp is a Date object
  return {
    ...result,
    timestamp: new Date(result.timestamp),
  };
};

/**
 * Analysis API service
 */
export const analysisApi = {
  analyzeUrl,
  analyzeText,
};
