import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';
import {
  errorHandler,
  ValidationError,
  FetchError,
  MLServiceError,
  TimeoutError,
  AppError,
} from './errorHandler';

/**
 * Feature: credibility-analyzer-backend, Property 8: Error Response Structure
 * Validates: Requirements 5.1
 *
 * For any error response, the body SHALL contain at minimum
 * a "code" field (string) and "message" field (string).
 */
describe('Error Response Structure Property Tests', () => {
  // Mock request object
  const createMockRequest = (): Partial<Request> => ({
    path: '/api/test',
    method: 'POST',
    ip: '127.0.0.1',
    get: vi.fn().mockReturnValue('test-user-agent'),
  });

  // Mock response object that captures the JSON response
  const createMockResponse = (): Partial<Response> & { jsonData: unknown; statusCode: number } => {
    const res: Partial<Response> & { jsonData: unknown; statusCode: number } = {
      jsonData: null,
      statusCode: 0,
      status: vi.fn().mockImplementation((code: number) => {
        res.statusCode = code;
        return res;
      }),
      json: vi.fn().mockImplementation((data: unknown) => {
        res.jsonData = data;
        return res;
      }),
    };
    return res;
  };

  const mockNext: NextFunction = vi.fn();

  // Generator for error messages
  const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 });

  // Generator for error codes
  const errorCodeArbitrary = fc.constantFrom(
    'VALIDATION_ERROR',
    'INVALID_URL',
    'EMPTY_INPUT',
    'TEXT_TOO_LONG',
    'FETCH_FAILED',
    'ML_SERVICE_UNAVAILABLE',
    'TIMEOUT',
    'INTERNAL_ERROR'
  );

  it('Property 8: ValidationError responses contain code and message fields', () => {
    fc.assert(
      fc.property(errorMessageArbitrary, errorCodeArbitrary, (message, code) => {
        const req = createMockRequest() as Request;
        const res = createMockResponse() as Response & { jsonData: unknown };

        const error = new ValidationError(message, code);
        errorHandler(error, req, res, mockNext);

        const response = res.jsonData as Record<string, unknown>;

        // Must have code field as string
        expect(response).toHaveProperty('code');
        expect(typeof response.code).toBe('string');
        expect(response.code).toBe(code);

        // Must have message field as string
        expect(response).toHaveProperty('message');
        expect(typeof response.message).toBe('string');
        expect(response.message).toBe(message);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 8: FetchError responses contain code and message fields', () => {
    fc.assert(
      fc.property(errorMessageArbitrary, (message) => {
        const req = createMockRequest() as Request;
        const res = createMockResponse() as Response & { jsonData: unknown };

        const error = new FetchError(message);
        errorHandler(error, req, res, mockNext);

        const response = res.jsonData as Record<string, unknown>;

        // Must have code field as string
        expect(response).toHaveProperty('code');
        expect(typeof response.code).toBe('string');
        expect(response.code).toBe('FETCH_FAILED');

        // Must have message field as string
        expect(response).toHaveProperty('message');
        expect(typeof response.message).toBe('string');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 8: MLServiceError responses contain code and message fields', () => {
    fc.assert(
      fc.property(errorMessageArbitrary, (message) => {
        const req = createMockRequest() as Request;
        const res = createMockResponse() as Response & { jsonData: unknown };

        const error = new MLServiceError(message);
        errorHandler(error, req, res, mockNext);

        const response = res.jsonData as Record<string, unknown>;

        // Must have code field as string
        expect(response).toHaveProperty('code');
        expect(typeof response.code).toBe('string');
        expect(response.code).toBe('ML_SERVICE_UNAVAILABLE');

        // Must have message field as string
        expect(response).toHaveProperty('message');
        expect(typeof response.message).toBe('string');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 8: TimeoutError responses contain code and message fields', () => {
    fc.assert(
      fc.property(errorMessageArbitrary, (message) => {
        const req = createMockRequest() as Request;
        const res = createMockResponse() as Response & { jsonData: unknown };

        const error = new TimeoutError(message);
        errorHandler(error, req, res, mockNext);

        const response = res.jsonData as Record<string, unknown>;

        // Must have code field as string
        expect(response).toHaveProperty('code');
        expect(typeof response.code).toBe('string');
        expect(response.code).toBe('TIMEOUT');

        // Must have message field as string
        expect(response).toHaveProperty('message');
        expect(typeof response.message).toBe('string');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 8: Generic Error responses contain code and message fields', () => {
    fc.assert(
      fc.property(errorMessageArbitrary, (message) => {
        const req = createMockRequest() as Request;
        const res = createMockResponse() as Response & { jsonData: unknown };

        const error = new Error(message);
        errorHandler(error, req, res, mockNext);

        const response = res.jsonData as Record<string, unknown>;

        // Must have code field as string
        expect(response).toHaveProperty('code');
        expect(typeof response.code).toBe('string');

        // Must have message field as string
        expect(response).toHaveProperty('message');
        expect(typeof response.message).toBe('string');

        return true;
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: credibility-analyzer-backend, Property 9: Error Sanitization
 * Validates: Requirements 5.3, 7.4
 *
 * For any error response in production mode, the response SHALL NOT contain
 * stack traces, file paths, or internal implementation details.
 */
describe('Error Sanitization Property Tests', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Set production mode for sanitization tests
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });

  // Mock request object
  const createMockRequest = (): Partial<Request> => ({
    path: '/api/test',
    method: 'POST',
    ip: '127.0.0.1',
    get: vi.fn().mockReturnValue('test-user-agent'),
  });

  // Mock response object that captures the JSON response
  const createMockResponse = (): Partial<Response> & { jsonData: unknown; statusCode: number } => {
    const res: Partial<Response> & { jsonData: unknown; statusCode: number } = {
      jsonData: null,
      statusCode: 0,
      status: vi.fn().mockImplementation((code: number) => {
        res.statusCode = code;
        return res;
      }),
      json: vi.fn().mockImplementation((data: unknown) => {
        res.jsonData = data;
        return res;
      }),
    };
    return res;
  };

  const mockNext: NextFunction = vi.fn();

  // Generator for error messages that might contain sensitive info
  const sensitiveMessageArbitrary = fc.oneof(
    fc.constant('Error at /home/user/project/src/file.ts:42'),
    fc.constant('TypeError: Cannot read property of undefined at Object.<anonymous> (/app/src/service.ts:15:23)'),
    fc.constant('ENOENT: no such file or directory, open \'/etc/passwd\''),
    fc.constant('Connection refused to database at localhost:5432'),
    fc.constant('Internal server error in module /node_modules/express/lib/router.js'),
    fc.string({ minLength: 1, maxLength: 200 })
  );

  // Patterns that should NOT appear in production error responses
  const sensitivePatterns = [
    /at\s+\S+\s+\(\S+:\d+:\d+\)/,  // Stack trace patterns like "at Function (file.ts:10:5)"
    /\/[a-zA-Z0-9_\-./]+\.(ts|js|tsx|jsx):\d+/,  // File paths with line numbers
    /node_modules/,  // Node modules paths
    /Error\.captureStackTrace/,  // Stack trace capture
    /at\s+Object\.<anonymous>/,  // Anonymous object stack traces
    /at\s+Module\._compile/,  // Module compilation stack traces
  ];

  /**
   * Helper to check if response contains sensitive information
   */
  const containsSensitiveInfo = (response: Record<string, unknown>): boolean => {
    const responseStr = JSON.stringify(response);

    for (const pattern of sensitivePatterns) {
      if (pattern.test(responseStr)) {
        return true;
      }
    }

    // Check for explicit stack property
    if ('stack' in response) {
      return true;
    }

    return false;
  };

  it('Property 9: Production error responses do not contain stack traces', () => {
    fc.assert(
      fc.property(sensitiveMessageArbitrary, (message) => {
        const req = createMockRequest() as Request;
        const res = createMockResponse() as Response & { jsonData: unknown };

        // Create an error with a stack trace
        const error = new Error(message);
        error.stack = `Error: ${message}\n    at Object.<anonymous> (/app/src/service.ts:15:23)\n    at Module._compile (node:internal/modules/cjs/loader:1254:14)`;

        errorHandler(error, req, res, mockNext);

        const response = res.jsonData as Record<string, unknown>;

        // Response should not contain stack traces
        expect(response).not.toHaveProperty('stack');
        expect(containsSensitiveInfo(response)).toBe(false);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: Production error responses use generic message for unknown errors', () => {
    fc.assert(
      fc.property(sensitiveMessageArbitrary, (message) => {
        const req = createMockRequest() as Request;
        const res = createMockResponse() as Response & { jsonData: unknown };

        // Create a generic error (not AppError)
        const error = new Error(message);
        errorHandler(error, req, res, mockNext);

        const response = res.jsonData as Record<string, unknown>;

        // In production, unknown errors should return generic message
        expect(response.code).toBe('INTERNAL_ERROR');
        expect(response.message).toBe('An unexpected error occurred');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: Production error responses do not expose file paths', () => {
    const filePathMessages = [
      'Error in /home/user/project/src/controllers/analysisController.ts',
      'Failed to load /app/config/secrets.json',
      'Module not found: /node_modules/express/lib/router/index.js',
      'ENOENT: /var/log/app.log',
    ];

    for (const message of filePathMessages) {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response & { jsonData: unknown };

      const error = new Error(message);
      errorHandler(error, req, res, mockNext);

      const response = res.jsonData as Record<string, unknown>;
      const responseStr = JSON.stringify(response);

      // Should not contain file paths
      expect(responseStr).not.toMatch(/\/[a-zA-Z0-9_\-./]+\.(ts|js|json)/);
      expect(responseStr).not.toContain('/home/');
      expect(responseStr).not.toContain('/app/');
      expect(responseStr).not.toContain('/var/');
      expect(responseStr).not.toContain('node_modules');
    }
  });

  it('Property 9: Known AppErrors preserve their message in production', () => {
    // Generator for AppError types
    const appErrorArbitrary = fc.oneof(
      fc.constant(() => new ValidationError('Invalid input provided', 'VALIDATION_ERROR')),
      fc.constant(() => new FetchError('Could not fetch URL')),
      fc.constant(() => new MLServiceError('ML service unavailable')),
      fc.constant(() => new TimeoutError('Request timed out'))
    );

    fc.assert(
      fc.property(appErrorArbitrary, (createError) => {
        const req = createMockRequest() as Request;
        const res = createMockResponse() as Response & { jsonData: unknown };

        const error = createError();
        errorHandler(error, req, res, mockNext);

        const response = res.jsonData as Record<string, unknown>;

        // Known errors should preserve their code and message
        expect(response.code).toBe(error.code);
        expect(response.message).toBe(error.message);

        // But should not contain stack traces
        expect(response).not.toHaveProperty('stack');

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
