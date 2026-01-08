/**
 * Integration tests for API endpoints
 * 
 * Tests:
 * - POST /api/analyze/url success
 * - POST /api/analyze/text success
 * - Validation error responses
 * - Health endpoints
 * 
 * Requirements: 1.1, 2.1, 8.1, 8.2
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

// Mock config - must be before imports that use it
vi.mock('../config', () => ({
  config: {
    port: 3000,
    mlServiceUrl: 'http://localhost:5000',
    corsOrigins: ['http://localhost:3000'],
    rateLimitWindow: 60000,
    rateLimitMax: 100,
  },
}));

// Mock logger to avoid console output during tests
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock MongoDB client
vi.mock('../database/mongoClient', () => ({
  mongoClient: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(false),
    getDb: vi.fn(),
    getPoolStats: vi.fn().mockReturnValue({ totalConnections: 0, availableConnections: 0, waitQueueSize: 0 }),
  },
}));

// Mock Redis client
vi.mock('../cache/redisClient', () => ({
  redisClient: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(false),
    getClient: vi.fn(),
    ping: vi.fn().mockResolvedValue(false),
  },
}));

// Mock cache service
vi.mock('../cache/cacheService', () => ({
  cacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
    getTtl: vi.fn().mockResolvedValue(-2),
  },
  cacheAnalysisResult: vi.fn().mockResolvedValue(undefined),
  getCachedAnalysisResult: vi.fn().mockResolvedValue(null),
  invalidateCachedAnalysisResult: vi.fn().mockResolvedValue(undefined),
  CacheKeyPatterns: {
    analysisResult: (id: string) => `analysis:${id}`,
    rateLimit: (ip: string, window: number) => `ratelimit:${ip}:${window}`,
    mlHealth: () => 'health:ml',
  },
}));

// Mock analysis repository
vi.mock('../database/repositories/analysisRepository', () => ({
  analysisRepository: {
    save: vi.fn().mockImplementation((result) => Promise.resolve(result)),
    findById: vi.fn().mockResolvedValue(null),
    findRecent: vi.fn().mockResolvedValue([]),
    deleteById: vi.fn().mockResolvedValue(false),
  },
}));

// Mock rate limit store - return a new store instance each time
vi.mock('../cache/rateLimitStore', () => ({
  createRedisRateLimitStore: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    increment: vi.fn().mockResolvedValue({ totalHits: 1, resetTime: new Date(Date.now() + 60000) }),
    decrement: vi.fn().mockResolvedValue(undefined),
    resetKey: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn(),
    isRedisAvailable: vi.fn().mockReturnValue(false),
    isUsingFallback: vi.fn().mockReturnValue(true),
  })),
  RedisRateLimitStore: vi.fn(),
  InMemoryStore: vi.fn(),
}));

// Mock the ML client to avoid actual ML service calls
const mockAnalyzeContent = vi.fn();
const mockIsMLServiceAvailable = vi.fn();

vi.mock('../services/mlClient', () => ({
  analyzeContent: mockAnalyzeContent,
  isMLServiceAvailable: mockIsMLServiceAvailable,
}));

// Mock the content fetcher to avoid actual HTTP calls
const mockFetchUrlContent = vi.fn();

vi.mock('../services/contentFetcher', () => ({
  fetchUrlContent: mockFetchUrlContent,
}));

describe('API Integration Tests', () => {
  let app: Application;

  // Import app once before all tests to avoid timeout issues
  // Increase timeout to 30 seconds for module loading
  beforeAll(async () => {
    const { createApp } = await import('../app');
    app = createApp();
  }, 30000);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default mock implementations
    mockAnalyzeContent.mockResolvedValue({
      score: 75,
      overview: 'Test analysis overview',
      redFlags: [
        { id: 'rf1', description: 'Test red flag', severity: 'medium' },
      ],
      positiveIndicators: [
        { id: 'pi1', description: 'Test positive indicator', icon: 'verified' },
      ],
      keywords: [
        { term: 'test', impact: 'positive', weight: 0.8 },
      ],
    });
    
    mockIsMLServiceAvailable.mockResolvedValue(true);
    
    mockFetchUrlContent.mockResolvedValue({
      content: 'Test page content',
      title: 'Test Page Title',
      thumbnail: 'https://example.com/image.jpg',
      sourceUrl: 'https://example.com/test',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Health Endpoints Tests
   * Requirements: 8.1, 8.2
   */
  describe('Health Endpoints', () => {
    describe('GET /health', () => {
      it('should return 200 with status ok', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);

        expect(response.body).toMatchObject({
          status: 'ok',
          service: 'credibility-analyzer-api',
        });
        expect(response.body.timestamp).toBeDefined();
      });
    });

    describe('GET /ready', () => {
      it('should return 200 when all critical services are available', async () => {
        // Mock ML service as available
        mockIsMLServiceAvailable.mockResolvedValueOnce(true);
        
        // Mock MongoDB as connected
        const { mongoClient } = await import('../database/mongoClient');
        vi.mocked(mongoClient.isConnected).mockReturnValueOnce(true);
        vi.mocked(mongoClient.getDb).mockReturnValueOnce({
          command: vi.fn().mockResolvedValueOnce({ ok: 1 }),
        } as unknown as ReturnType<typeof mongoClient.getDb>);

        // Mock Redis as connected
        const { redisClient } = await import('../cache/redisClient');
        vi.mocked(redisClient.isConnected).mockReturnValueOnce(true);
        vi.mocked(redisClient.ping).mockResolvedValueOnce(true);

        const response = await request(app)
          .get('/ready')
          .expect(200);

        expect(response.body).toMatchObject({
          status: 'healthy',
          dependencies: {
            mlService: {
              status: 'up',
            },
            mongodb: {
              status: 'up',
            },
            redis: {
              status: 'up',
            },
          },
        });
      });

      it('should return 503 when ML service is unavailable', async () => {
        mockIsMLServiceAvailable.mockResolvedValueOnce(false);

        const response = await request(app)
          .get('/ready')
          .expect(503);

        expect(response.body).toMatchObject({
          status: 'unhealthy',
          dependencies: {
            mlService: {
              status: 'down',
            },
          },
        });
      });
    });
  });

  /**
   * URL Analysis Endpoint Tests
   * Requirements: 1.1
   */
  describe('POST /api/analyze/url', () => {
    it('should return analysis result for valid URL', async () => {
      const response = await request(app)
        .post('/api/analyze/url')
        .set('Content-Type', 'application/json')
        .send({ url: 'https://example.com/article' })
        .expect(200);

      expect(response.body).toMatchObject({
        input: {
          type: 'url',
          value: 'https://example.com/article',
        },
        score: 75,
        overview: 'Test analysis overview',
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.redFlags).toHaveLength(1);
      expect(response.body.positiveIndicators).toHaveLength(1);
      expect(response.body.keywords).toHaveLength(1);
    });

    it('should include metadata from fetched content', async () => {
      const response = await request(app)
        .post('/api/analyze/url')
        .set('Content-Type', 'application/json')
        .send({ url: 'https://example.com/article' })
        .expect(200);

      expect(response.body.metadata).toMatchObject({
        title: 'Test Page Title',
        thumbnail: 'https://example.com/image.jpg',
        sourceUrl: 'https://example.com/test',
      });
    });
  });

  /**
   * Text Analysis Endpoint Tests
   * Requirements: 2.1
   */
  describe('POST /api/analyze/text', () => {
    it('should return analysis result for valid text', async () => {
      const response = await request(app)
        .post('/api/analyze/text')
        .set('Content-Type', 'application/json')
        .send({ text: 'This is test content for analysis.' })
        .expect(200);

      expect(response.body).toMatchObject({
        input: {
          type: 'text',
          value: 'This is test content for analysis.',
        },
        score: 75,
        overview: 'Test analysis overview',
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  /**
   * Validation Error Tests
   * Requirements: 1.2, 2.2, 2.3, 6.1, 6.2
   */
  describe('Validation Errors', () => {
    describe('URL Validation', () => {
      it('should return 400 for invalid URL (no protocol)', async () => {
        const response = await request(app)
          .post('/api/analyze/url')
          .set('Content-Type', 'application/json')
          .send({ url: 'example.com/article' })
          .expect(400);

        expect(response.body).toMatchObject({
          code: 'INVALID_URL',
        });
      });

      it('should return 400 for invalid URL (ftp protocol)', async () => {
        const response = await request(app)
          .post('/api/analyze/url')
          .set('Content-Type', 'application/json')
          .send({ url: 'ftp://example.com/file' })
          .expect(400);

        expect(response.body).toMatchObject({
          code: 'INVALID_URL',
        });
      });

      it('should return 400 for missing URL field', async () => {
        const response = await request(app)
          .post('/api/analyze/url')
          .set('Content-Type', 'application/json')
          .send({})
          .expect(400);

        expect(response.body.code).toBe('INVALID_URL');
      });
    });

    describe('Text Validation', () => {
      it('should return 400 for empty text', async () => {
        const response = await request(app)
          .post('/api/analyze/text')
          .set('Content-Type', 'application/json')
          .send({ text: '' })
          .expect(400);

        expect(response.body).toMatchObject({
          code: 'EMPTY_INPUT',
        });
      });

      it('should return 400 for whitespace-only text', async () => {
        const response = await request(app)
          .post('/api/analyze/text')
          .set('Content-Type', 'application/json')
          .send({ text: '   \t\n  ' })
          .expect(400);

        expect(response.body).toMatchObject({
          code: 'EMPTY_INPUT',
        });
      });

      it('should return 400 for text exceeding 10,000 characters', async () => {
        const longText = 'a'.repeat(10001);
        const response = await request(app)
          .post('/api/analyze/text')
          .set('Content-Type', 'application/json')
          .send({ text: longText })
          .expect(400);

        expect(response.body).toMatchObject({
          code: 'TEXT_TOO_LONG',
        });
      });

      it('should return 400 for missing text field', async () => {
        const response = await request(app)
          .post('/api/analyze/text')
          .set('Content-Type', 'application/json')
          .send({})
          .expect(400);

        expect(response.body.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('Content-Type Validation', () => {
      it('should return 400 for wrong Content-Type header on URL endpoint', async () => {
        const response = await request(app)
          .post('/api/analyze/url')
          .set('Content-Type', 'text/plain')
          .send('url=https://example.com')
          .expect(400);

        expect(response.body).toMatchObject({
          code: 'VALIDATION_ERROR',
          message: 'Content-Type header must be application/json',
        });
      });

      it('should return 400 for wrong Content-Type on text endpoint', async () => {
        const response = await request(app)
          .post('/api/analyze/text')
          .set('Content-Type', 'text/plain')
          .send('Some text')
          .expect(400);

        expect(response.body).toMatchObject({
          code: 'VALIDATION_ERROR',
        });
      });
    });
  });

  /**
   * 404 Not Found Tests
   */
  describe('Not Found', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown')
        .expect(404);

      expect(response.body).toMatchObject({
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
      });
    });
  });
});
