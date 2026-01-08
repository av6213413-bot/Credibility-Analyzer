import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { analyzeContent, isMLServiceAvailable, MLAnalysisResponse } from './mlClient';
import { MLServiceError, TimeoutError } from '../middleware/errorHandler';

// Mock config
vi.mock('../config', () => ({
  config: {
    mlServiceUrl: 'http://localhost:5000',
  },
}));

// Mock logger to avoid console output during tests
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock axios
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    default: {
      post: vi.fn(),
      get: vi.fn(),
      isCancel: actual.default.isCancel,
    },
    AxiosError: actual.AxiosError,
    AxiosHeaders: actual.AxiosHeaders,
  };
});

/**
 * Helper to create a proper AxiosError instance
 */
function createAxiosError(
  message: string,
  code?: string,
  response?: {
    status: number;
    statusText: string;
    data?: unknown;
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
    response ? {
      status: response.status,
      statusText: response.statusText,
      data: response.data || {},
      headers: {},
      config,
    } : undefined
  );
  
  return error;
}

describe('ML Client', () => {
  const mockMLResponse: MLAnalysisResponse = {
    score: 75,
    overview: 'This content appears to be moderately credible.',
    red_flags: [
      { id: 'rf1', description: 'Missing citations', severity: 'medium' },
    ],
    positive_indicators: [
      { id: 'pi1', description: 'Author credentials verified', icon: 'verified' },
    ],
    keywords: [
      { term: 'research', impact: 'positive', weight: 0.8 },
      { term: 'unverified', impact: 'negative', weight: 0.6 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('analyzeContent', () => {
    describe('successful analysis', () => {
      it('should return transformed analysis result on successful ML service call', async () => {
        vi.mocked(axios.post).mockResolvedValueOnce({
          data: mockMLResponse,
          status: 200,
        });

        const result = await analyzeContent('Test content for analysis');

        expect(result).toEqual({
          score: 75,
          overview: 'This content appears to be moderately credible.',
          redFlags: [
            { id: 'rf1', description: 'Missing citations', severity: 'medium' },
          ],
          positiveIndicators: [
            { id: 'pi1', description: 'Author credentials verified', icon: 'verified' },
          ],
          keywords: [
            { term: 'research', impact: 'positive', weight: 0.8 },
            { term: 'unverified', impact: 'negative', weight: 0.6 },
          ],
        });
      });

      it('should call ML service with correct parameters', async () => {
        vi.mocked(axios.post).mockResolvedValueOnce({
          data: mockMLResponse,
          status: 200,
        });

        await analyzeContent('Test content', 'https://example.com');

        expect(axios.post).toHaveBeenCalledWith(
          'http://localhost:5000/analyze',
          {
            text: 'Test content',
            source_url: 'https://example.com',
          },
          expect.objectContaining({
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      it('should pass null for source_url when not provided', async () => {
        vi.mocked(axios.post).mockResolvedValueOnce({
          data: mockMLResponse,
          status: 200,
        });

        await analyzeContent('Test content');

        expect(axios.post).toHaveBeenCalledWith(
          'http://localhost:5000/analyze',
          {
            text: 'Test content',
            source_url: null,
          },
          expect.any(Object)
        );
      });
    });

    describe('service unavailable handling', () => {
      it('should throw MLServiceError when connection is refused', async () => {
        const error = createAxiosError('Connection refused', 'ECONNREFUSED');
        vi.mocked(axios.post).mockRejectedValueOnce(error);

        await expect(analyzeContent('Test content')).rejects.toThrow(MLServiceError);
      });

      it('should throw MLServiceError with correct message when connection is refused', async () => {
        const error = createAxiosError('Connection refused', 'ECONNREFUSED');
        vi.mocked(axios.post).mockRejectedValueOnce(error);

        try {
          await analyzeContent('Test content');
          expect.fail('Should have thrown');
        } catch (e) {
          expect(e).toBeInstanceOf(MLServiceError);
          expect((e as MLServiceError).message).toBe('ML service is not available');
        }
      });

      it('should throw MLServiceError when host is not found', async () => {
        const error = createAxiosError('Host not found', 'ENOTFOUND');
        vi.mocked(axios.post).mockRejectedValueOnce(error);

        await expect(analyzeContent('Test content')).rejects.toThrow(MLServiceError);
      });

      it('should throw MLServiceError with correct message when host is not found', async () => {
        const error = createAxiosError('Host not found', 'ENOTFOUND');
        vi.mocked(axios.post).mockRejectedValueOnce(error);

        try {
          await analyzeContent('Test content');
          expect.fail('Should have thrown');
        } catch (e) {
          expect(e).toBeInstanceOf(MLServiceError);
          expect((e as MLServiceError).message).toBe('ML service host not found');
        }
      });

      it('should throw MLServiceError on 500 server error', async () => {
        const error = createAxiosError('Internal Server Error', undefined, {
          status: 500,
          statusText: 'Internal Server Error',
        });
        vi.mocked(axios.post).mockRejectedValueOnce(error);

        await expect(analyzeContent('Test content')).rejects.toThrow(MLServiceError);
      });

      it('should throw MLServiceError on 400 bad request', async () => {
        const error = createAxiosError('Bad Request', undefined, {
          status: 400,
          statusText: 'Bad Request',
          data: { message: 'Invalid input' },
        });
        vi.mocked(axios.post).mockRejectedValueOnce(error);

        await expect(analyzeContent('Test content')).rejects.toThrow(MLServiceError);
      });

      it('should include rejection message for 400 errors', async () => {
        const error = createAxiosError('Bad Request', undefined, {
          status: 400,
          statusText: 'Bad Request',
          data: { message: 'Invalid input' },
        });
        vi.mocked(axios.post).mockRejectedValueOnce(error);

        try {
          await analyzeContent('Test content');
          expect.fail('Should have thrown');
        } catch (e) {
          expect(e).toBeInstanceOf(MLServiceError);
          expect((e as MLServiceError).message).toContain('ML service rejected the request');
        }
      });
    });

    describe('timeout handling', () => {
      it('should throw TimeoutError when request times out (ETIMEDOUT)', async () => {
        const error = createAxiosError('Timeout', 'ETIMEDOUT');
        vi.mocked(axios.post).mockRejectedValueOnce(error);

        await expect(analyzeContent('Test content')).rejects.toThrow(TimeoutError);
      });

      it('should throw TimeoutError with correct message', async () => {
        const error = createAxiosError('Timeout', 'ETIMEDOUT');
        vi.mocked(axios.post).mockRejectedValueOnce(error);

        try {
          await analyzeContent('Test content');
          expect.fail('Should have thrown');
        } catch (e) {
          expect(e).toBeInstanceOf(TimeoutError);
          expect((e as TimeoutError).message).toContain('timed out');
        }
      });

      it('should throw TimeoutError when connection is aborted', async () => {
        const error = createAxiosError('Connection aborted', 'ECONNABORTED');
        vi.mocked(axios.post).mockRejectedValueOnce(error);

        await expect(analyzeContent('Test content')).rejects.toThrow(TimeoutError);
      });

      it('should use custom timeout when provided', async () => {
        vi.mocked(axios.post).mockResolvedValueOnce({
          data: mockMLResponse,
          status: 200,
        });

        await analyzeContent('Test content', undefined, 5000);

        expect(axios.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          expect.objectContaining({
            timeout: 5000,
          })
        );
      });
    });
  });

  describe('isMLServiceAvailable', () => {
    it('should return true when ML service health check succeeds', async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' },
      });

      const result = await isMLServiceAvailable();

      expect(result).toBe(true);
      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:5000/health',
        expect.objectContaining({
          timeout: 5000,
        })
      );
    });

    it('should return false when ML service health check fails', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Connection refused'));

      const result = await isMLServiceAvailable();

      expect(result).toBe(false);
    });

    it('should use custom timeout when provided', async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' },
      });

      await isMLServiceAvailable(3000);

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeout: 3000,
        })
      );
    });
  });
});
