/**
 * Property-based tests for Sentry Service
 * Feature: monitoring-maintenance, Property 9: Error Context Capture
 * Validates: Requirements 7.1, 7.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Request } from 'express';
import {
  extractRequestContext,
  RequestContext,
} from './sentryService';

/**
 * Property 9: Error Context Capture
 * For any unhandled exception captured by the error tracker, the captured event
 * SHALL include the original stack trace and request context (URL path, HTTP method,
 * sanitized user agent).
 * Validates: Requirements 7.1, 7.3
 */
describe('Property 9: Error Context Capture', () => {
  /**
   * Helper to create a mock Express request
   */
  function createMockRequest(options: {
    path: string;
    method: string;
    userAgent?: string;
    requestId?: string;
  }): Request {
    const req = {
      path: options.path,
      method: options.method,
      get: (header: string) => {
        if (header.toLowerCase() === 'user-agent') {
          return options.userAgent;
        }
        return undefined;
      },
      id: options.requestId,
    } as unknown as Request;
    return req;
  }

  /**
   * Property: extractRequestContext should always include URL path
   */
  it('should always include URL path in extracted context', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webPath(),
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
        fc.option(fc.string({ minLength: 1, maxLength: 200 })),
        async (path, method, userAgent) => {
          const req = createMockRequest({
            path,
            method,
            userAgent: userAgent ?? undefined,
          });

          const context = extractRequestContext(req);

          // URL path should always be present and match the request path
          expect(context.url).toBe(path);
          return context.url === path;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extractRequestContext should always include HTTP method
   */
  it('should always include HTTP method in extracted context', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webPath(),
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'),
        fc.option(fc.string({ minLength: 1, maxLength: 200 })),
        async (path, method, userAgent) => {
          const req = createMockRequest({
            path,
            method,
            userAgent: userAgent ?? undefined,
          });

          const context = extractRequestContext(req);

          // HTTP method should always be present and match the request method
          expect(context.method).toBe(method);
          return context.method === method;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extractRequestContext should always include user agent (sanitized)
   */
  it('should always include sanitized user agent in extracted context', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webPath(),
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        fc.string({ minLength: 0, maxLength: 500 }),
        async (path, method, userAgent) => {
          const req = createMockRequest({
            path,
            method,
            userAgent,
          });

          const context = extractRequestContext(req);

          // User agent should always be present
          expect(context.userAgent).toBeDefined();
          // User agent should be truncated to max 200 characters
          expect(context.userAgent.length).toBeLessThanOrEqual(200);
          return context.userAgent !== undefined && context.userAgent.length <= 200;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extractRequestContext should handle missing user agent
   */
  it('should handle missing user agent gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webPath(),
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        async (path, method) => {
          const req = createMockRequest({
            path,
            method,
            userAgent: undefined,
          });

          const context = extractRequestContext(req);

          // Should default to 'unknown' when user agent is missing
          expect(context.userAgent).toBe('unknown');
          return context.userAgent === 'unknown';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extractRequestContext should include request ID when present
   */
  it('should include request ID when present', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webPath(),
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        fc.uuid(),
        async (path, method, requestId) => {
          const req = createMockRequest({
            path,
            method,
            requestId,
          });

          const context = extractRequestContext(req);

          // Request ID should be included when present
          expect(context.requestId).toBe(requestId);
          return context.requestId === requestId;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extractRequestContext should return all required fields
   */
  it('should return all required context fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webPath(),
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.option(fc.uuid()),
        async (path, method, userAgent, requestId) => {
          const req = createMockRequest({
            path,
            method,
            userAgent,
            requestId: requestId ?? undefined,
          });

          const context = extractRequestContext(req);

          // Verify all required fields are present
          const hasUrl = typeof context.url === 'string';
          const hasMethod = typeof context.method === 'string';
          const hasUserAgent = typeof context.userAgent === 'string';

          return hasUrl && hasMethod && hasUserAgent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extractRequestContext should not include query parameters in URL
   */
  it('should use path only without query parameters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webPath(),
        fc.constantFrom('GET', 'POST'),
        async (path, method) => {
          const req = createMockRequest({
            path,
            method,
          });

          const context = extractRequestContext(req);

          // URL should be the path (which doesn't include query params)
          // The path property in Express already excludes query params
          expect(context.url).toBe(path);
          return context.url === path;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: User agent truncation should preserve start of string
   */
  it('should truncate user agent from the end, preserving the start', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webPath(),
        fc.constantFrom('GET', 'POST'),
        fc.string({ minLength: 201, maxLength: 500 }),
        async (path, method, longUserAgent) => {
          const req = createMockRequest({
            path,
            method,
            userAgent: longUserAgent,
          });

          const context = extractRequestContext(req);

          // Truncated user agent should be the first 200 characters
          expect(context.userAgent).toBe(longUserAgent.substring(0, 200));
          return context.userAgent === longUserAgent.substring(0, 200);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Context should be a valid RequestContext type
   */
  it('should return a valid RequestContext object', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webPath(),
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (path, method, userAgent) => {
          const req = createMockRequest({
            path,
            method,
            userAgent,
          });

          const context: RequestContext = extractRequestContext(req);

          // Verify the object conforms to RequestContext interface
          const isValidContext =
            'url' in context &&
            'method' in context &&
            'userAgent' in context &&
            typeof context.url === 'string' &&
            typeof context.method === 'string' &&
            typeof context.userAgent === 'string';

          return isValidContext;
        }
      ),
      { numRuns: 100 }
    );
  });
});
