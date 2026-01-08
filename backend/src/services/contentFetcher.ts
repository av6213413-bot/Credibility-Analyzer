import axios, { AxiosError } from 'axios';
import { FetchError, TimeoutError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { getMetricsService } from '../monitoring';

/**
 * Error types for scraping metrics categorization
 * Requirements: 3.1, 3.5
 */
export type ScrapingErrorType = 'timeout' | 'blocked' | 'not_found' | 'network_error' | 'parse_error';

/**
 * Categorizes an error into a scraping error type for metrics
 * @param error - The error to categorize
 * @returns The categorized error type
 */
export function categorizeScrapingError(error: unknown): ScrapingErrorType {
  // Timeout errors
  if (error instanceof TimeoutError) {
    return 'timeout';
  }

  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const code = error.code;

    // Timeout-related error codes
    if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
      return 'timeout';
    }

    // Not found errors
    if (status === 404) {
      return 'not_found';
    }

    // Blocked/forbidden errors
    if (status === 403 || status === 401 || status === 429) {
      return 'blocked';
    }

    // Network errors
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ENETUNREACH') {
      return 'network_error';
    }

    // Server errors are treated as network errors
    if (status && status >= 500) {
      return 'network_error';
    }
  }

  // FetchError with specific messages
  if (error instanceof FetchError) {
    const message = error.message.toLowerCase();
    if (message.includes('not found') || message.includes('404')) {
      return 'not_found';
    }
    if (message.includes('forbidden') || message.includes('blocked') || message.includes('authentication')) {
      return 'blocked';
    }
    if (message.includes('html content') || message.includes('parse')) {
      return 'parse_error';
    }
  }

  // Default to network_error for unknown errors
  return 'network_error';
}

/**
 * Records a successful scraping operation in metrics
 */
export function recordScrapingSuccess(): void {
  try {
    const metrics = getMetricsService();
    metrics.scrapingSuccessTotal.inc();
  } catch {
    // Silently ignore metrics errors to not break the application
    logger.debug('Failed to record scraping success metric');
  }
}

/**
 * Records a failed scraping operation in metrics with error categorization
 * @param error - The error that caused the failure
 */
export function recordScrapingFailure(error: unknown): void {
  try {
    const metrics = getMetricsService();
    const errorType = categorizeScrapingError(error);
    metrics.scrapingFailureTotal.inc({ error_type: errorType });
  } catch {
    // Silently ignore metrics errors to not break the application
    logger.debug('Failed to record scraping failure metric');
  }
}

/**
 * Result of fetching URL content
 */
export interface FetchedContent {
  /** The text content extracted from the page */
  content: string;
  /** The page title extracted from <title> tag */
  title?: string;
  /** The thumbnail URL extracted from og:image meta tag */
  thumbnail?: string;
  /** The source URL that was fetched */
  sourceUrl: string;
}

/** Default timeout for fetch operations in milliseconds */
const DEFAULT_TIMEOUT_MS = 30000;

/** Maximum content length to process (10MB) */
const MAX_CONTENT_LENGTH = 10 * 1024 * 1024;

/**
 * Extracts the page title from HTML content
 * Looks for <title>...</title> tag
 * @param html - The HTML content to parse
 * @returns The extracted title or undefined if not found
 */
export function extractTitle(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    // Decode HTML entities and trim whitespace
    return decodeHtmlEntities(titleMatch[1].trim());
  }
  return undefined;
}

/**
 * Extracts the og:image URL from HTML content
 * Looks for <meta property="og:image" content="..."> tag
 * @param html - The HTML content to parse
 * @returns The extracted thumbnail URL or undefined if not found
 */
export function extractOgImage(html: string): string | undefined {
  // Match og:image meta tag with various attribute orders
  const ogImageMatch = html.match(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i
  ) || html.match(
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i
  );
  
  if (ogImageMatch && ogImageMatch[1]) {
    return ogImageMatch[1].trim();
  }
  return undefined;
}

/**
 * Extracts text content from HTML by removing tags and scripts
 * @param html - The HTML content to parse
 * @returns The extracted text content
 */
export function extractTextContent(html: string): string {
  // Remove script and style tags with their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode HTML entities
  text = decodeHtmlEntities(text);
  
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Decodes common HTML entities
 * @param text - Text with HTML entities
 * @returns Decoded text
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  };
  
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  
  // Handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => 
    String.fromCharCode(parseInt(num, 10))
  );
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => 
    String.fromCharCode(parseInt(hex, 16))
  );
  
  return decoded;
}


/**
 * Fetches content from a URL and extracts relevant information
 * 
 * @param url - The URL to fetch content from
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns FetchedContent with extracted text, title, and thumbnail
 * @throws FetchError if the URL cannot be fetched (404, blocked, etc.)
 * @throws TimeoutError if the request exceeds the timeout
 * 
 * Requirements: 1.1, 1.3, 1.5
 */
export async function fetchUrlContent(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<FetchedContent> {
  // Create AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    logger.info('Fetching URL content', { url });

    const response = await axios.get(url, {
      signal: controller.signal,
      timeout: timeoutMs,
      maxContentLength: MAX_CONTENT_LENGTH,
      headers: {
        'User-Agent': 'CredibilityAnalyzer/1.0 (Content Analysis Bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      // Follow redirects
      maxRedirects: 5,
      // Validate status codes
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const html = response.data;
    
    // Ensure we got string content
    if (typeof html !== 'string') {
      throw new FetchError(
        'URL did not return HTML content',
        'Please ensure the URL points to a web page'
      );
    }

    // Extract metadata
    const title = extractTitle(html);
    const thumbnail = extractOgImage(html);
    const content = extractTextContent(html);

    logger.info('Successfully fetched URL content', {
      url,
      titleFound: !!title,
      thumbnailFound: !!thumbnail,
      contentLength: content.length,
    });

    // Record successful scraping metric
    recordScrapingSuccess();

    return {
      content,
      title,
      thumbnail,
      sourceUrl: url,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // Record failed scraping metric
    recordScrapingFailure(error);

    // Handle abort/timeout
    if (axios.isCancel(error) || (error instanceof Error && error.name === 'AbortError')) {
      logger.warn('URL fetch timed out', { url, timeoutMs });
      throw new TimeoutError(`Request to ${url} timed out after ${timeoutMs}ms`);
    }

    // Handle Axios errors
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const statusText = error.response?.statusText || 'Unknown error';

      logger.warn('URL fetch failed', { url, status, statusText, code: error.code });

      // Handle specific HTTP status codes
      if (status === 404) {
        throw new FetchError(
          `Page not found: ${url}`,
          'Please verify the URL exists and try again'
        );
      }

      if (status === 403) {
        throw new FetchError(
          `Access forbidden: ${url}`,
          'The website may be blocking automated access'
        );
      }

      if (status === 401) {
        throw new FetchError(
          `Authentication required: ${url}`,
          'The page requires login credentials'
        );
      }

      if (status && status >= 500) {
        throw new FetchError(
          `Server error from ${url}: ${statusText}`,
          'The website may be experiencing issues. Please try again later'
        );
      }

      // Handle network errors
      if (error.code === 'ECONNREFUSED') {
        throw new FetchError(
          `Connection refused: ${url}`,
          'The website may be down or blocking connections'
        );
      }

      if (error.code === 'ENOTFOUND') {
        throw new FetchError(
          `Domain not found: ${url}`,
          'Please verify the URL is correct'
        );
      }

      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        throw new TimeoutError(`Request to ${url} timed out`);
      }

      // Generic fetch error
      throw new FetchError(
        `Failed to fetch content from ${url}: ${error.message}`,
        'Please verify the URL is accessible and try again'
      );
    }

    // Re-throw if it's already our custom error
    if (error instanceof FetchError || error instanceof TimeoutError) {
      throw error;
    }

    // Unknown error
    logger.error('Unexpected error fetching URL', { url, error });
    throw new FetchError(
      `Unexpected error fetching ${url}`,
      'Please try again or contact support if the issue persists'
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
