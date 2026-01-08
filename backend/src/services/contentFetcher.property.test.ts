/**
 * Property-based tests for Content Fetcher Scraping Metrics
 * Feature: monitoring-maintenance, Property 3: Scraping Metrics Categorization
 * Validates: Requirements 3.1, 3.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import {
  categorizeScrapingError,
  ScrapingErrorType,
  recordScrapingSuccess,
  recordScrapingFailure,
} from './contentFetcher';
import { FetchError, TimeoutError } from '../middleware/errorHandler';
import { resetMetricsService, getMetricsService } from '../monitoring';

// Mock logger to avoid console output during tests
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

/**
 * Helper to create a proper AxiosError instance
 */
function createAxiosError(
  message: string,
  code?: string,
  response?: {
    status: number;
    statusText: string;
  }
): AxiosError {
  const config: InternalAxiosRequestConfig = {
    headers: new AxiosHeaders(),
  };

  const error = new AxiosError(
    message,
    code,
    config,
    undefined,
    response
      ? {
          status: response.status,
          statusText: response.statusText,
          data: {},
          headers: {},
          config,
        }
      : undefined
  );

  return error;
}

/**
 * Property 3: Scraping Metrics Categorization
 * For any scraping operation (success or failure), the metrics service SHALL
 * increment the appropriate counter, and failures SHALL be labeled with the
 * correct error type (timeout, blocked, not_found, network_error, parse_error).
 * Validates: Requirements 3.1, 3.5
 */
describe('Property 3: Scraping Metrics Categorization', () => {
  const validErrorTypes: ScrapingErrorType[] = [
    'timeout',
    'blocked',
    'not_found',
    'network_error',
    'parse_error',
  ];

  beforeEach(() => {
    resetMetricsService();
  });

  /**
   * Property: categorizeScrapingError should always return a valid error type
   */
  it('should always return a valid error type for any error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // TimeoutError
          fc.constant(new TimeoutError('Request timed out')),
          // AxiosError with timeout codes
          fc.constantFrom('ETIMEDOUT', 'ECONNABORTED').map((code) =>
            createAxiosError('Timeout', code)
          ),
          // AxiosError with 404
          fc.constant(
            createAxiosError('Not Found', undefined, { status: 404, statusText: 'Not Found' })
          ),
          // AxiosError with blocked status codes
          fc.constantFrom(401, 403, 429).map((status) =>
            createAxiosError('Blocked', undefined, { status, statusText: 'Blocked' })
          ),
          // AxiosError with network error codes
          fc.constantFrom('ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH').map((code) =>
            createAxiosError('Network error', code)
          ),
          // AxiosError with server errors
          fc.integer({ min: 500, max: 599 }).map((status) =>
            createAxiosError('Server error', undefined, { status, statusText: 'Server Error' })
          ),
          // FetchError with various messages
          fc.constantFrom(
            new FetchError('Page not found', 'Check URL'),
            new FetchError('Access forbidden', 'Blocked'),
            new FetchError('URL did not return HTML content', 'Parse error'),
            new FetchError('Authentication required', 'Login needed'),
            new FetchError('Unknown error', 'Try again')
          ),
          // Generic errors
          fc.constant(new Error('Generic error'))
        ),
        async (error) => {
          const errorType = categorizeScrapingError(error);
          expect(validErrorTypes).toContain(errorType);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: TimeoutError should always be categorized as 'timeout'
   */
  it('should categorize TimeoutError as timeout', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (message) => {
          const error = new TimeoutError(message);
          const errorType = categorizeScrapingError(error);
          expect(errorType).toBe('timeout');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: AxiosError with timeout codes should be categorized as 'timeout'
   */
  it('should categorize AxiosError with timeout codes as timeout', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('ETIMEDOUT', 'ECONNABORTED'),
        async (code) => {
          const error = createAxiosError('Timeout', code);
          const errorType = categorizeScrapingError(error);
          expect(errorType).toBe('timeout');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: AxiosError with 404 status should be categorized as 'not_found'
   */
  it('should categorize 404 errors as not_found', () => {
    const error = createAxiosError('Not Found', undefined, {
      status: 404,
      statusText: 'Not Found',
    });
    const errorType = categorizeScrapingError(error);
    expect(errorType).toBe('not_found');
  });

  /**
   * Property: AxiosError with blocked status codes should be categorized as 'blocked'
   */
  it('should categorize blocked status codes as blocked', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(401, 403, 429),
        async (status) => {
          const error = createAxiosError('Blocked', undefined, {
            status,
            statusText: 'Blocked',
          });
          const errorType = categorizeScrapingError(error);
          expect(errorType).toBe('blocked');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: AxiosError with network error codes should be categorized as 'network_error'
   */
  it('should categorize network error codes as network_error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH'),
        async (code) => {
          const error = createAxiosError('Network error', code);
          const errorType = categorizeScrapingError(error);
          expect(errorType).toBe('network_error');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: AxiosError with 5xx status should be categorized as 'network_error'
   */
  it('should categorize 5xx errors as network_error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 500, max: 599 }),
        async (status) => {
          const error = createAxiosError('Server error', undefined, {
            status,
            statusText: 'Server Error',
          });
          const errorType = categorizeScrapingError(error);
          expect(errorType).toBe('network_error');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: recordScrapingSuccess should increment scraping_success_total
   */
  it('should increment scraping_success_total on success', async () => {
    const metrics = getMetricsService();
    const initialMetrics = await metrics.getMetrics();
    const initialMatch = initialMetrics.match(/scraping_success_total\s+(\d+)/);
    const initialCount = initialMatch ? parseInt(initialMatch[1], 10) : 0;

    recordScrapingSuccess();

    const updatedMetrics = await metrics.getMetrics();
    const updatedMatch = updatedMetrics.match(/scraping_success_total\s+(\d+)/);
    const updatedCount = updatedMatch ? parseInt(updatedMatch[1], 10) : 0;

    expect(updatedCount).toBe(initialCount + 1);
  });

  /**
   * Property: recordScrapingFailure should increment scraping_failure_total with correct error_type
   */
  it('should increment scraping_failure_total with correct error_type label', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant({ error: new TimeoutError('timeout'), expectedType: 'timeout' }),
          fc.constant({
            error: createAxiosError('Not Found', undefined, { status: 404, statusText: 'Not Found' }),
            expectedType: 'not_found',
          }),
          fc.constant({
            error: createAxiosError('Forbidden', undefined, { status: 403, statusText: 'Forbidden' }),
            expectedType: 'blocked',
          }),
          fc.constant({
            error: createAxiosError('Network', 'ECONNREFUSED'),
            expectedType: 'network_error',
          })
        ),
        async ({ error, expectedType }) => {
          resetMetricsService();
          const metrics = getMetricsService();

          recordScrapingFailure(error);

          const metricsOutput = await metrics.getMetrics();
          expect(metricsOutput).toContain('scraping_failure_total');
          expect(metricsOutput).toContain(`error_type="${expectedType}"`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple scraping operations should correctly accumulate metrics
   */
  it('should correctly accumulate metrics for multiple operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        async (successCount, failureCount) => {
          resetMetricsService();
          const metrics = getMetricsService();

          // Record successes
          for (let i = 0; i < successCount; i++) {
            recordScrapingSuccess();
          }

          // Record failures
          for (let i = 0; i < failureCount; i++) {
            recordScrapingFailure(new TimeoutError('timeout'));
          }

          const metricsOutput = await metrics.getMetrics();

          // Check success count
          const successMatch = metricsOutput.match(/scraping_success_total\s+(\d+)/);
          const actualSuccessCount = successMatch ? parseInt(successMatch[1], 10) : 0;
          expect(actualSuccessCount).toBe(successCount);

          // Check failure count
          const failureMatch = metricsOutput.match(
            /scraping_failure_total\{error_type="timeout"\}\s+(\d+)/
          );
          const actualFailureCount = failureMatch ? parseInt(failureMatch[1], 10) : 0;
          expect(actualFailureCount).toBe(failureCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
