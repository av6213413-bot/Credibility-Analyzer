import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import {
  fetchUrlContent,
  extractTitle,
  extractOgImage,
  extractTextContent,
} from './contentFetcher';
import { FetchError, TimeoutError } from '../middleware/errorHandler';

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
    response
      ? {
          status: response.status,
          statusText: response.statusText,
          data: response.data || {},
          headers: {},
          config,
        }
      : undefined
  );

  return error;
}

describe('Content Fetcher', () => {
  const sampleHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Page Title</title>
      <meta property="og:image" content="https://example.com/image.jpg">
    </head>
    <body>
      <h1>Hello World</h1>
      <p>This is test content.</p>
      <script>console.log('test');</script>
    </body>
    </html>
  `;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchUrlContent', () => {
    describe('successful fetch', () => {
      it('should return fetched content with title and thumbnail', async () => {
        vi.mocked(axios.get).mockResolvedValueOnce({
          data: sampleHtml,
          status: 200,
        });

        const result = await fetchUrlContent('https://example.com/page');

        expect(result).toEqual({
          content: expect.any(String),
          title: 'Test Page Title',
          thumbnail: 'https://example.com/image.jpg',
          sourceUrl: 'https://example.com/page',
        });
      });

      it('should extract text content without HTML tags', async () => {
        vi.mocked(axios.get).mockResolvedValueOnce({
          data: sampleHtml,
          status: 200,
        });

        const result = await fetchUrlContent('https://example.com/page');

        expect(result.content).toContain('Hello World');
        expect(result.content).toContain('This is test content');
        expect(result.content).not.toContain('<h1>');
        expect(result.content).not.toContain('<script>');
      });

      it('should call axios with correct parameters', async () => {
        vi.mocked(axios.get).mockResolvedValueOnce({
          data: sampleHtml,
          status: 200,
        });

        await fetchUrlContent('https://example.com/page');

        expect(axios.get).toHaveBeenCalledWith(
          'https://example.com/page',
          expect.objectContaining({
            timeout: 30000,
            maxRedirects: 5,
            headers: expect.objectContaining({
              'User-Agent': expect.stringContaining('CredibilityAnalyzer'),
            }),
          })
        );
      });
    });

    describe('404 handling', () => {
      it('should throw FetchError when page returns 404', async () => {
        const error = createAxiosError('Not Found', undefined, {
          status: 404,
          statusText: 'Not Found',
        });
        vi.mocked(axios.get).mockRejectedValueOnce(error);

        await expect(
          fetchUrlContent('https://example.com/nonexistent')
        ).rejects.toThrow(FetchError);
      });

      it('should include helpful message for 404 errors', async () => {
        const error = createAxiosError('Not Found', undefined, {
          status: 404,
          statusText: 'Not Found',
        });
        vi.mocked(axios.get).mockRejectedValueOnce(error);

        try {
          await fetchUrlContent('https://example.com/nonexistent');
          expect.fail('Should have thrown');
        } catch (e) {
          expect(e).toBeInstanceOf(FetchError);
          expect((e as FetchError).message).toContain('Page not found');
          expect((e as FetchError).suggestedAction).toContain('verify the URL');
        }
      });
    });

    describe('timeout handling', () => {
      it('should throw TimeoutError when request times out (ETIMEDOUT)', async () => {
        const error = createAxiosError('Timeout', 'ETIMEDOUT');
        vi.mocked(axios.get).mockRejectedValueOnce(error);

        await expect(
          fetchUrlContent('https://example.com/slow')
        ).rejects.toThrow(TimeoutError);
      });

      it('should throw TimeoutError when connection is aborted', async () => {
        const error = createAxiosError('Connection aborted', 'ECONNABORTED');
        vi.mocked(axios.get).mockRejectedValueOnce(error);

        await expect(
          fetchUrlContent('https://example.com/slow')
        ).rejects.toThrow(TimeoutError);
      });

      it('should use custom timeout when provided', async () => {
        vi.mocked(axios.get).mockResolvedValueOnce({
          data: sampleHtml,
          status: 200,
        });

        await fetchUrlContent('https://example.com/page', 5000);

        expect(axios.get).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            timeout: 5000,
          })
        );
      });
    });
  });

  describe('extractTitle', () => {
    it('should extract title from HTML', () => {
      const html = '<html><head><title>My Title</title></head></html>';
      expect(extractTitle(html)).toBe('My Title');
    });

    it('should return undefined when no title found', () => {
      const html = '<html><head></head></html>';
      expect(extractTitle(html)).toBeUndefined();
    });

    it('should decode HTML entities in title', () => {
      const html = '<html><head><title>Test &amp; Title</title></head></html>';
      expect(extractTitle(html)).toBe('Test & Title');
    });
  });

  describe('extractOgImage', () => {
    it('should extract og:image from meta tag', () => {
      const html =
        '<html><head><meta property="og:image" content="https://example.com/img.jpg"></head></html>';
      expect(extractOgImage(html)).toBe('https://example.com/img.jpg');
    });

    it('should return undefined when no og:image found', () => {
      const html = '<html><head></head></html>';
      expect(extractOgImage(html)).toBeUndefined();
    });

    it('should handle reversed attribute order', () => {
      const html =
        '<html><head><meta content="https://example.com/img.jpg" property="og:image"></head></html>';
      expect(extractOgImage(html)).toBe('https://example.com/img.jpg');
    });
  });

  describe('extractTextContent', () => {
    it('should remove HTML tags', () => {
      const html = '<p>Hello <strong>World</strong></p>';
      expect(extractTextContent(html)).toBe('Hello World');
    });

    it('should remove script tags and content', () => {
      const html = '<p>Text</p><script>alert("test");</script><p>More</p>';
      expect(extractTextContent(html)).toBe('Text More');
    });

    it('should remove style tags and content', () => {
      const html = '<p>Text</p><style>.class { color: red; }</style><p>More</p>';
      expect(extractTextContent(html)).toBe('Text More');
    });

    it('should decode HTML entities', () => {
      const html = '<p>Test &amp; Content &lt;here&gt;</p>';
      expect(extractTextContent(html)).toBe('Test & Content <here>');
    });
  });
});
