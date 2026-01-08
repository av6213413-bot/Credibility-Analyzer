/**
 * Property tests for security middleware
 * Feature: credibility-analyzer-backend, Property 10: Security Headers Presence
 * Validates: Requirements 7.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import express, { Express, Request, Response } from 'express';
import { securityHeaders } from './security';

describe('Security Headers Property Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(securityHeaders);
    app.get('/test', (_req: Request, res: Response) => {
      res.json({ message: 'ok' });
    });
    app.post('/test', (_req: Request, res: Response) => {
      res.json({ message: 'ok' });
    });
  });

  /**
   * Property 10: Security Headers Presence
   * For any HTTP response, the headers SHALL include X-Content-Type-Options,
   * X-Frame-Options, and X-XSS-Protection.
   */
  describe('Property 10: Security Headers Presence', () => {
    it('should include required security headers for any GET request', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant('/test'),
          async (path) => {
            const response = await new Promise<{
              statusCode: number;
              headers: Record<string, string | string[] | undefined>;
            }>((resolve) => {
              const req = {
                method: 'GET',
                url: path,
                headers: {},
                on: () => {},
                removeListener: () => {},
              } as unknown as Request;

              const headers: Record<string, string | string[] | undefined> = {};
              const res = {
                statusCode: 200,
                setHeader: (name: string, value: string) => {
                  headers[name.toLowerCase()] = value;
                },
                getHeader: (name: string) => headers[name.toLowerCase()],
                removeHeader: () => {},
                on: () => {},
                once: () => {},
                emit: () => {},
                end: () => {
                  resolve({ statusCode: 200, headers });
                },
                write: () => {},
                writeHead: () => {},
              } as unknown as Response;

              // Apply helmet middleware
              securityHeaders(req, res, () => {
                res.end();
              });
            });

            // Verify required security headers are present
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBe('DENY');
            expect(response.headers['x-xss-protection']).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include X-Content-Type-Options header set to nosniff', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(true),
          async () => {
            const headers: Record<string, string | string[] | undefined> = {};
            
            await new Promise<void>((resolve) => {
              const req = {
                method: 'GET',
                url: '/test',
                headers: {},
                on: () => {},
                removeListener: () => {},
              } as unknown as Request;

              const res = {
                statusCode: 200,
                setHeader: (name: string, value: string) => {
                  headers[name.toLowerCase()] = value;
                },
                getHeader: (name: string) => headers[name.toLowerCase()],
                removeHeader: () => {},
                on: () => {},
                once: () => {},
                emit: () => {},
                end: () => resolve(),
                write: () => {},
                writeHead: () => {},
              } as unknown as Response;

              securityHeaders(req, res, () => {
                res.end();
              });
            });

            expect(headers['x-content-type-options']).toBe('nosniff');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include X-Frame-Options header set to DENY', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(true),
          async () => {
            const headers: Record<string, string | string[] | undefined> = {};
            
            await new Promise<void>((resolve) => {
              const req = {
                method: 'GET',
                url: '/test',
                headers: {},
                on: () => {},
                removeListener: () => {},
              } as unknown as Request;

              const res = {
                statusCode: 200,
                setHeader: (name: string, value: string) => {
                  headers[name.toLowerCase()] = value;
                },
                getHeader: (name: string) => headers[name.toLowerCase()],
                removeHeader: () => {},
                on: () => {},
                once: () => {},
                emit: () => {},
                end: () => resolve(),
                write: () => {},
                writeHead: () => {},
              } as unknown as Response;

              securityHeaders(req, res, () => {
                res.end();
              });
            });

            expect(headers['x-frame-options']).toBe('DENY');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include X-XSS-Protection header', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(true),
          async () => {
            const headers: Record<string, string | string[] | undefined> = {};
            
            await new Promise<void>((resolve) => {
              const req = {
                method: 'GET',
                url: '/test',
                headers: {},
                on: () => {},
                removeListener: () => {},
              } as unknown as Request;

              const res = {
                statusCode: 200,
                setHeader: (name: string, value: string) => {
                  headers[name.toLowerCase()] = value;
                },
                getHeader: (name: string) => headers[name.toLowerCase()],
                removeHeader: () => {},
                on: () => {},
                once: () => {},
                emit: () => {},
                end: () => resolve(),
                write: () => {},
                writeHead: () => {},
              } as unknown as Response;

              securityHeaders(req, res, () => {
                res.end();
              });
            });

            expect(headers['x-xss-protection']).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
