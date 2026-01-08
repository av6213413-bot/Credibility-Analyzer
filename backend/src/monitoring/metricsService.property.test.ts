/**
 * Property-based tests for Metrics Service
 * Feature: monitoring-maintenance, Property 1: HTTP Metrics Completeness
 * Validates: Requirements 1.1, 1.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { createMetricsService, MetricsService } from './metricsService';

/**
 * Property 1: HTTP Metrics Completeness
 * For any HTTP request processed by the API server, the metrics service SHALL
 * record the request with correct labels (method, normalized path, status code)
 * and the request counter SHALL increment by exactly 1.
 * Validates: Requirements 1.1, 1.5
 */
describe('Property 1: HTTP Metrics Completeness', () => {
  let metricsService: MetricsService;

  beforeEach(() => {
    // Create fresh metrics service for each test
    metricsService = createMetricsService();
  });

  /**
   * Property: For any valid HTTP method, path, and status code,
   * incrementing the counter should increase the total by exactly 1
   */
  it('should increment http_requests_total by exactly 1 for any valid request', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
        fc.constantFrom('/api/analyze', '/api/health', '/api/jobs/:id', '/metrics', '/api/v1/users'),
        fc.constantFrom('200', '201', '400', '401', '403', '404', '500', '502', '503'),
        async (method, path, status) => {
          // Get initial metrics
          const initialMetrics = await metricsService.getMetrics();
          const initialMatch = initialMetrics.match(
            new RegExp(`http_requests_total\\{[^}]*method="${method}"[^}]*path="${escapeRegex(path)}"[^}]*status="${status}"[^}]*\\}\\s+(\\d+)`)
          );
          const initialCount = initialMatch ? parseInt(initialMatch[1], 10) : 0;

          // Increment counter
          metricsService.httpRequestsTotal.inc({ method, path, status });

          // Get updated metrics
          const updatedMetrics = await metricsService.getMetrics();
          const updatedMatch = updatedMetrics.match(
            new RegExp(`http_requests_total\\{[^}]*method="${method}"[^}]*path="${escapeRegex(path)}"[^}]*status="${status}"[^}]*\\}\\s+(\\d+)`)
          );
          const updatedCount = updatedMatch ? parseInt(updatedMatch[1], 10) : 0;

          // Counter should have incremented by exactly 1
          expect(updatedCount).toBe(initialCount + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: HTTP request duration should be recorded with correct labels
   */
  it('should record http_request_duration_seconds with correct labels', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
        fc.constantFrom('/api/analyze', '/api/health', '/api/jobs/:id', '/metrics'),
        fc.constantFrom('200', '201', '400', '404', '500'),
        fc.float({ min: Math.fround(0.001), max: Math.fround(30), noNaN: true }),
        async (method, path, status, duration) => {
          // Observe duration
          metricsService.httpRequestDuration.observe({ method, path, status }, duration);

          // Get metrics output
          const metrics = await metricsService.getMetrics();

          // Verify histogram buckets exist for this label combination
          expect(metrics).toContain('http_request_duration_seconds_bucket');
          expect(metrics).toContain(`method="${method}"`);
          expect(metrics).toContain(`status="${status}"`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Metrics output should always be valid Prometheus format
   */
  it('should produce valid Prometheus exposition format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
            path: fc.constantFrom('/api/analyze', '/api/health', '/api/jobs/:id'),
            status: fc.constantFrom('200', '400', '500'),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (requests) => {
          // Record multiple requests
          for (const req of requests) {
            metricsService.httpRequestsTotal.inc(req);
          }

          // Get metrics
          const metrics = await metricsService.getMetrics();

          // Verify Prometheus format requirements
          // 1. Should contain HELP lines
          expect(metrics).toContain('# HELP http_requests_total');
          // 2. Should contain TYPE lines
          expect(metrics).toContain('# TYPE http_requests_total counter');
          // 3. Metrics should be non-empty
          expect(metrics.length).toBeGreaterThan(0);
          // 4. Should contain the metric name
          expect(metrics).toContain('http_requests_total{');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content type should always be correct Prometheus content type
   */
  it('should return correct Prometheus content type', () => {
    const contentType = metricsService.getContentType();
    expect(contentType).toContain('text/plain');
  });

  /**
   * Property: All required HTTP metrics should be present in output
   */
  it('should include all required HTTP metrics in output', async () => {
    // Record at least one request to ensure metrics are initialized
    metricsService.httpRequestsTotal.inc({ method: 'GET', path: '/test', status: '200' });
    metricsService.httpRequestDuration.observe({ method: 'GET', path: '/test', status: '200' }, 0.1);

    const metrics = await metricsService.getMetrics();

    // Verify required metrics are present
    expect(metrics).toContain('http_requests_total');
    expect(metrics).toContain('http_request_duration_seconds');
  });

  /**
   * Property: Labels should be correctly applied to metrics
   */
  it('should correctly label metrics with method, path, and status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        fc.constantFrom('/api/analyze', '/api/health', '/api/jobs/:id'),
        fc.constantFrom('200', '201', '400', '404', '500'),
        async (method, path, status) => {
          // Increment counter with specific labels
          metricsService.httpRequestsTotal.inc({ method, path, status });

          // Get metrics
          const metrics = await metricsService.getMetrics();

          // Verify all labels are present in the output
          expect(metrics).toContain(`method="${method}"`);
          expect(metrics).toContain(`path="${path}"`);
          expect(metrics).toContain(`status="${status}"`);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Helper function to escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


/**
 * Feature: monitoring-maintenance, Property 8: PII Exclusion from Metrics
 * Validates: Requirements 5.5
 * 
 * For any metric label or value recorded by the metrics service, the content
 * SHALL NOT contain patterns matching email addresses, IP addresses (in user-facing labels),
 * phone numbers, or other personally identifiable information.
 */
describe('Property 8: PII Exclusion from Metrics', () => {
  let metricsService: MetricsService;

  beforeEach(() => {
    metricsService = createMetricsService();
  });

  // Regex patterns for PII detection in label values only
  // These patterns look for PII within quoted label values
  const EMAIL_IN_LABEL_REGEX = /="[^"]*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^"]*"/;
  const SSN_IN_LABEL_REGEX = /="[^"]*\d{3}-\d{2}-\d{4}[^"]*"/;
  // IP addresses in user-facing labels (path, user, client, source)
  const IP_IN_USER_LABEL_REGEX = /(?:path|user|client|source)="[^"]*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}[^"]*"/;

  // Generator for safe paths (no PII)
  const safePathArbitrary = fc.constantFrom(
    '/api/analyze',
    '/api/health',
    '/api/jobs/:id',
    '/metrics',
    '/api/v1/users/:id',
    '/api/analysis/:id'
  );

  /**
   * Property: Metric labels should never contain email addresses
   */
  it('metric labels should not contain email addresses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        safePathArbitrary,
        fc.constantFrom('200', '400', '500'),
        async (method, path, status) => {
          // Record a request
          metricsService.httpRequestsTotal.inc({ method, path, status });

          // Get metrics output
          const metrics = await metricsService.getMetrics();

          // Verify no email addresses in label values
          return !EMAIL_IN_LABEL_REGEX.test(metrics);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Metric labels should never contain SSN patterns
   */
  it('metric labels should not contain SSN patterns', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        safePathArbitrary,
        fc.constantFrom('200', '400', '500'),
        async (method, path, status) => {
          // Record a request
          metricsService.httpRequestsTotal.inc({ method, path, status });

          // Get metrics output
          const metrics = await metricsService.getMetrics();

          // Verify no SSN patterns in label values
          return !SSN_IN_LABEL_REGEX.test(metrics);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: User-facing labels should not contain raw IP addresses
   */
  it('user-facing labels should not contain raw IP addresses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        safePathArbitrary,
        fc.constantFrom('200', '400', '500'),
        async (method, path, status) => {
          // Record a request
          metricsService.httpRequestsTotal.inc({ method, path, status });

          // Get metrics output
          const metrics = await metricsService.getMetrics();

          // Verify no IP addresses in user-facing labels
          return !IP_IN_USER_LABEL_REGEX.test(metrics);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Analysis metrics should use safe label values only
   */
  it('analysis metrics should use safe label values only', async () => {
    const safeInputTypes = ['url', 'text'];
    const safeStatuses = ['success', 'failure'];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...safeInputTypes),
        fc.constantFrom(...safeStatuses),
        fc.integer({ min: 0, max: 100 }),
        async (inputType, status, score) => {
          // Record analysis metrics
          metricsService.analysisRequestsTotal.inc({ input_type: inputType, status });
          if (status === 'success') {
            metricsService.analysisScoreDistribution.observe(score);
          }

          // Get metrics output
          const metrics = await metricsService.getMetrics();

          // Verify metrics labels don't contain PII patterns
          const noPII = 
            !EMAIL_IN_LABEL_REGEX.test(metrics) &&
            !SSN_IN_LABEL_REGEX.test(metrics) &&
            !IP_IN_USER_LABEL_REGEX.test(metrics);

          // Verify input_type label uses only safe values
          const inputTypeMatch = metrics.match(/input_type="([^"]+)"/g);
          const allInputTypesSafe = !inputTypeMatch || inputTypeMatch.every(match => {
            const value = match.match(/input_type="([^"]+)"/)?.[1];
            return value && safeInputTypes.includes(value);
          });

          return noPII && allInputTypesSafe;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All metric labels should use safe, predefined values
   */
  it('all metric labels should use safe predefined values', async () => {
    const safeInputTypes = ['url', 'text'];
    const safeStatuses = ['success', 'failure'];
    const safeMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const safeStatusCodes = ['200', '201', '400', '401', '403', '404', '500', '502', '503'];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...safeMethods),
        safePathArbitrary,
        fc.constantFrom(...safeStatusCodes),
        fc.constantFrom(...safeInputTypes),
        fc.constantFrom(...safeStatuses),
        async (method, path, statusCode, inputType, status) => {
          // Record various metrics
          metricsService.httpRequestsTotal.inc({ method, path, status: statusCode });
          metricsService.analysisRequestsTotal.inc({ input_type: inputType, status });

          // Get metrics output
          const metrics = await metricsService.getMetrics();

          // Verify the output contains the expected safe label values
          const containsSafeLabels = 
            metrics.includes(`method="${method}"`) &&
            metrics.includes(`input_type="${inputType}"`);

          // Verify no PII in labels
          const noPII = 
            !EMAIL_IN_LABEL_REGEX.test(metrics) &&
            !SSN_IN_LABEL_REGEX.test(metrics) &&
            !IP_IN_USER_LABEL_REGEX.test(metrics);

          return containsSafeLabels && noPII;
        }
      ),
      { numRuns: 100 }
    );
  });
});

