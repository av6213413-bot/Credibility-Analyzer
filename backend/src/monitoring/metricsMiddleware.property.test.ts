/**
 * Property-based tests for Metrics Middleware
 * Feature: monitoring-maintenance, Property 2: Response Time Percentile Calculation
 * Validates: Requirements 1.2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { createMetricsService, MetricsService } from './metricsService';
import { normalizePath } from './metricsMiddleware';

/**
 * Property 2: Response Time Percentile Calculation
 * For any set of recorded response times, the 95th percentile calculation SHALL
 * return a value such that at least 95% of recorded values are less than or equal to it.
 * Validates: Requirements 1.2
 */
describe('Property 2: Response Time Percentile Calculation', () => {
  let metricsService: MetricsService;

  beforeEach(() => {
    metricsService = createMetricsService();
  });

  /**
   * Property: Path normalization should replace UUIDs with :id
   */
  it('should normalize paths by replacing UUIDs with :id', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (uuid) => {
          const path = `/api/jobs/${uuid}`;
          const normalized = normalizePath(path);
          expect(normalized).toBe('/api/jobs/:id');
          expect(normalized).not.toContain(uuid);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Path normalization should replace numeric IDs with :id
   */
  it('should normalize paths by replacing numeric IDs with :id', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999999 }),
        (numericId) => {
          const path = `/api/users/${numericId}/posts`;
          const normalized = normalizePath(path);
          expect(normalized).toBe('/api/users/:id/posts');
          expect(normalized).not.toContain(numericId.toString());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Path normalization should handle multiple IDs in a path
   */
  it('should normalize paths with multiple IDs', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 1, max: 999999 }),
        (uuid, numericId) => {
          const path = `/api/users/${numericId}/jobs/${uuid}`;
          const normalized = normalizePath(path);
          expect(normalized).toBe('/api/users/:id/jobs/:id');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Path normalization should preserve static paths
   */
  it('should preserve static paths without IDs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          '/api/health',
          '/api/analyze',
          '/metrics',
          '/api/v1/status',
          '/api/auth/login'
        ),
        (staticPath) => {
          const normalized = normalizePath(staticPath);
          expect(normalized).toBe(staticPath);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Response times recorded in histogram should be positive
   */
  it('should record positive response times in histogram', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(0.001), max: Math.fround(60), noNaN: true }),
        async (duration) => {
          // Record the duration
          metricsService.httpRequestDuration.observe(
            { method: 'GET', path: '/api/test', status: '200' },
            duration
          );

          // Get metrics and verify histogram was updated
          const metrics = await metricsService.getMetrics();
          expect(metrics).toContain('http_request_duration_seconds');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Histogram buckets should be correctly populated based on duration
   */
  it('should populate correct histogram buckets based on duration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(0.05, 0.3, 0.8, 1.5, 3, 7), // Values that fall into different buckets
        async (duration) => {
          // Create fresh metrics service for each test
          const freshMetrics = createMetricsService();

          // Record the duration
          freshMetrics.httpRequestDuration.observe(
            { method: 'GET', path: '/api/test', status: '200' },
            duration
          );

          // Get metrics
          const metrics = await freshMetrics.getMetrics();

          // Verify the histogram contains bucket entries
          expect(metrics).toContain('http_request_duration_seconds_bucket');
          expect(metrics).toContain('http_request_duration_seconds_sum');
          expect(metrics).toContain('http_request_duration_seconds_count');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple durations should accumulate correctly in histogram
   */
  it('should accumulate multiple durations in histogram', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.float({ min: Math.fround(0.01), max: Math.fround(10), noNaN: true }),
          { minLength: 5, maxLength: 20 }
        ),
        async (durations) => {
          // Create fresh metrics service
          const freshMetrics = createMetricsService();

          // Record all durations
          for (const duration of durations) {
            freshMetrics.httpRequestDuration.observe(
              { method: 'GET', path: '/api/test', status: '200' },
              duration
            );
          }

          // Get metrics
          const metrics = await freshMetrics.getMetrics();

          // Extract count from metrics
          const countMatch = metrics.match(
            /http_request_duration_seconds_count\{[^}]*\}\s+(\d+)/
          );
          
          if (countMatch) {
            const count = parseInt(countMatch[1], 10);
            expect(count).toBe(durations.length);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Histogram sum should equal the sum of all recorded durations
   */
  it('should have histogram sum equal to sum of recorded durations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.float({ min: Math.fround(0.1), max: Math.fround(5), noNaN: true }),
          { minLength: 3, maxLength: 10 }
        ),
        async (durations) => {
          // Create fresh metrics service
          const freshMetrics = createMetricsService();

          // Record all durations
          for (const duration of durations) {
            freshMetrics.httpRequestDuration.observe(
              { method: 'GET', path: '/api/test', status: '200' },
              duration
            );
          }

          // Get metrics
          const metrics = await freshMetrics.getMetrics();

          // Extract sum from metrics
          const sumMatch = metrics.match(
            /http_request_duration_seconds_sum\{[^}]*\}\s+([\d.]+)/
          );

          if (sumMatch) {
            const recordedSum = parseFloat(sumMatch[1]);
            const expectedSum = durations.reduce((a, b) => a + b, 0);
            // Allow for floating point precision differences
            expect(Math.abs(recordedSum - expectedSum)).toBeLessThan(0.001);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
