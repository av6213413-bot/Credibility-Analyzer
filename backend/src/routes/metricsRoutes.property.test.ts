/**
 * Property-based tests for Metrics Routes
 * Feature: monitoring-maintenance, Property 10: Prometheus Format Compliance
 * Feature: monitoring-maintenance, Property 11: Metrics Endpoint Access Control
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import express, { Express } from 'express';
import request from 'supertest';
import { metricsRoutes, isInternalNetwork } from './metricsRoutes';
import { resetMetricsService, getMetricsService } from '../monitoring';

/**
 * Property 10: Prometheus Format Compliance
 * For any response from the /metrics endpoint, the content SHALL be valid
 * Prometheus exposition format containing at minimum: http_requests_total,
 * http_request_duration_seconds, and analysis_requests_total metrics.
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */
describe('Property 10: Prometheus Format Compliance', () => {
  let app: Express;

  beforeEach(() => {
    // Reset metrics service for clean state
    resetMetricsService();
    
    // Create test app with metrics routes
    app = express();
    
    // Mock internal network access for testing by setting x-forwarded-for header
    app.use((req, _res, next) => {
      req.headers['x-forwarded-for'] = '127.0.0.1';
      next();
    });
    
    app.use('/', metricsRoutes);
  });

  afterEach(() => {
    resetMetricsService();
  });

  /**
   * Property: Metrics endpoint should return valid Prometheus exposition format
   */
  it('should return valid Prometheus exposition format with required metrics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 10 }),
        async (requestCount) => {
          // Initialize metrics with some data
          const metricsService = getMetricsService();
          for (let i = 0; i < requestCount; i++) {
            metricsService.httpRequestsTotal.inc({ method: 'GET', path: '/test', status: '200' });
          }

          const response = await request(app).get('/metrics');

          expect(response.status).toBe(200);
          
          // Verify Prometheus format requirements
          const body = response.text;
          
          // 1. Should contain HELP lines for required metrics
          expect(body).toContain('# HELP http_requests_total');
          expect(body).toContain('# HELP http_request_duration_seconds');
          expect(body).toContain('# HELP analysis_requests_total');
          
          // 2. Should contain TYPE lines for required metrics
          expect(body).toContain('# TYPE http_requests_total counter');
          expect(body).toContain('# TYPE http_request_duration_seconds histogram');
          expect(body).toContain('# TYPE analysis_requests_total counter');
          
          // 3. Content should be non-empty
          expect(body.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  /**
   * Property: Content-Type header should be correct Prometheus format
   */
  it('should return correct Content-Type header for Prometheus', async () => {
    const response = await request(app).get('/metrics');
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
  });

  /**
   * Property: Metrics should include standard HTTP metrics with correct format
   */
  it('should include HTTP metrics in correct Prometheus format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        fc.constantFrom('/api/analyze', '/api/health', '/api/jobs/:id'),
        fc.constantFrom('200', '400', '500'),
        async (method, path, status) => {
          const metricsService = getMetricsService();
          metricsService.httpRequestsTotal.inc({ method, path, status });

          const response = await request(app).get('/metrics');

          expect(response.status).toBe(200);
          
          // Verify metric line format: metric_name{labels} value
          const body = response.text;
          expect(body).toMatch(/http_requests_total\{[^}]+\}\s+\d+/);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  /**
   * Property: Metrics should include business metrics (analysis_requests_total)
   */
  it('should include business metrics in Prometheus format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('url', 'text'),
        fc.constantFrom('success', 'failure'),
        async (inputType, status) => {
          const metricsService = getMetricsService();
          metricsService.analysisRequestsTotal.inc({ input_type: inputType, status });

          const response = await request(app).get('/metrics');

          expect(response.status).toBe(200);
          expect(response.text).toContain('analysis_requests_total');
          expect(response.text).toContain(`input_type="${inputType}"`);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  /**
   * Property: Prometheus format should have valid line structure
   */
  it('should produce metrics with valid Prometheus line structure', async () => {
    const metricsService = getMetricsService();
    metricsService.httpRequestsTotal.inc({ method: 'GET', path: '/test', status: '200' });

    const response = await request(app).get('/metrics');
    const lines = response.text.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Each line should be either:
      // 1. A comment (starts with #)
      // 2. A metric line (metric_name{labels} value or metric_name value)
      // 3. Empty line
      const isComment = line.startsWith('#');
      const isEmpty = line.trim() === '';
      // More permissive regex for metric lines - allows for various numeric formats
      const isMetricLine = /^[a-zA-Z_:][a-zA-Z0-9_:]*(\{[^}]*\})?\s+[\d.eE+\-NaInf]+(\s+\d+)?$/.test(line);
      
      expect(isComment || isEmpty || isMetricLine).toBe(true);
    }
  });
});


/**
 * Property 11: Metrics Endpoint Access Control
 * For any request to the /metrics endpoint from outside the internal network
 * without valid authentication, the server SHALL return a 401 or 403 status code.
 * Validates: Requirements 10.5
 */
describe('Property 11: Metrics Endpoint Access Control', () => {
  let app: Express;
  const originalEnv = process.env.METRICS_AUTH_TOKEN;

  beforeEach(() => {
    // Reset metrics service for clean state
    resetMetricsService();
    
    // Create test app with metrics routes (no internal network mock)
    app = express();
    app.use('/', metricsRoutes);
  });

  afterEach(() => {
    resetMetricsService();
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.METRICS_AUTH_TOKEN = originalEnv;
    } else {
      delete process.env.METRICS_AUTH_TOKEN;
    }
  });

  /**
   * Property: Internal network IPs should be allowed access
   */
  it('should allow access from internal network IPs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '127.0.0.1',
          'localhost',
          '10.0.0.1',
          '10.255.255.255',
          '172.16.0.1',
          '172.31.255.255',
          '192.168.0.1',
          '192.168.255.255'
        ),
        async (internalIp) => {
          // Create app with internal IP
          const testApp = express();
          testApp.use((req, _res, next) => {
            req.headers['x-forwarded-for'] = internalIp;
            next();
          });
          testApp.use('/', metricsRoutes);

          const response = await request(testApp).get('/metrics');

          // Should be allowed (200) from internal network
          expect(response.status).toBe(200);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  /**
   * Property: External IPs without auth should be denied
   */
  it('should deny access from external IPs without authentication', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '8.8.8.8',
          '1.1.1.1',
          '203.0.113.1',
          '198.51.100.1',
          '172.32.0.1',  // Just outside private range
          '11.0.0.1'     // Just outside 10.x range
        ),
        async (externalIp) => {
          // Ensure no auth token is configured
          delete process.env.METRICS_AUTH_TOKEN;

          // Create app with external IP
          const testApp = express();
          testApp.use((req, _res, next) => {
            req.headers['x-forwarded-for'] = externalIp;
            next();
          });
          testApp.use('/', metricsRoutes);

          const response = await request(testApp).get('/metrics');

          // Should be denied (403) from external network without auth token configured
          expect(response.status).toBe(403);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  /**
   * Property: External IPs with valid auth should be allowed
   */
  it('should allow access from external IPs with valid authentication', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('8.8.8.8', '1.1.1.1', '203.0.113.1'),
        fc.hexaString({ minLength: 16, maxLength: 64 }),
        async (externalIp, authToken) => {
          // Set auth token
          process.env.METRICS_AUTH_TOKEN = authToken;

          // Create app with external IP
          const testApp = express();
          testApp.use((req, _res, next) => {
            req.headers['x-forwarded-for'] = externalIp;
            next();
          });
          testApp.use('/', metricsRoutes);

          const response = await request(testApp)
            .get('/metrics')
            .set('Authorization', `Bearer ${authToken}`);

          // Should be allowed with valid auth
          expect(response.status).toBe(200);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  /**
   * Property: External IPs with invalid auth should be denied
   */
  it('should deny access from external IPs with invalid authentication', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('8.8.8.8', '1.1.1.1', '203.0.113.1'),
        fc.hexaString({ minLength: 16, maxLength: 64 }),
        fc.hexaString({ minLength: 1, maxLength: 64 }),
        async (externalIp, validToken, invalidToken) => {
          // Ensure tokens are different
          if (validToken === invalidToken) return;

          // Set auth token
          process.env.METRICS_AUTH_TOKEN = validToken;

          // Create app with external IP
          const testApp = express();
          testApp.use((req, _res, next) => {
            req.headers['x-forwarded-for'] = externalIp;
            next();
          });
          testApp.use('/', metricsRoutes);

          const response = await request(testApp)
            .get('/metrics')
            .set('Authorization', `Bearer ${invalidToken}`);

          // Should be denied with invalid auth
          expect(response.status).toBe(401);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  /**
   * Property: Missing Authorization header should return 401 when token is configured
   */
  it('should return 401 for external IPs without Authorization header when token is configured', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('8.8.8.8', '1.1.1.1', '203.0.113.1'),
        fc.hexaString({ minLength: 16, maxLength: 64 }),
        async (externalIp, authToken) => {
          // Set auth token
          process.env.METRICS_AUTH_TOKEN = authToken;

          // Create app with external IP
          const testApp = express();
          testApp.use((req, _res, next) => {
            req.headers['x-forwarded-for'] = externalIp;
            next();
          });
          testApp.use('/', metricsRoutes);

          const response = await request(testApp).get('/metrics');

          // Should return 401 without Authorization header
          expect(response.status).toBe(401);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});

/**
 * Unit tests for isInternalNetwork helper function
 */
describe('isInternalNetwork helper', () => {
  it('should identify localhost as internal', () => {
    expect(isInternalNetwork('127.0.0.1')).toBe(true);
    expect(isInternalNetwork('localhost')).toBe(true);
    expect(isInternalNetwork('::1')).toBe(true);
    expect(isInternalNetwork('::ffff:127.0.0.1')).toBe(true);
  });

  it('should identify 10.x.x.x range as internal', () => {
    expect(isInternalNetwork('10.0.0.1')).toBe(true);
    expect(isInternalNetwork('10.255.255.255')).toBe(true);
  });

  it('should identify 172.16-31.x.x range as internal', () => {
    expect(isInternalNetwork('172.16.0.1')).toBe(true);
    expect(isInternalNetwork('172.31.255.255')).toBe(true);
    expect(isInternalNetwork('172.15.0.1')).toBe(false);
    expect(isInternalNetwork('172.32.0.1')).toBe(false);
  });

  it('should identify 192.168.x.x range as internal', () => {
    expect(isInternalNetwork('192.168.0.1')).toBe(true);
    expect(isInternalNetwork('192.168.255.255')).toBe(true);
  });

  it('should identify external IPs as not internal', () => {
    expect(isInternalNetwork('8.8.8.8')).toBe(false);
    expect(isInternalNetwork('1.1.1.1')).toBe(false);
    expect(isInternalNetwork('203.0.113.1')).toBe(false);
  });

  it('should handle undefined and invalid inputs', () => {
    expect(isInternalNetwork(undefined)).toBe(false);
    expect(isInternalNetwork('')).toBe(false);
    expect(isInternalNetwork('invalid')).toBe(false);
  });
});
