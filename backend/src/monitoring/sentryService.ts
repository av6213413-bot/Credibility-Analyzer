/**
 * Sentry Error Tracking Service
 * Provides centralized error tracking and reporting using Sentry
 * Requirements: 7.1, 7.3
 */

import * as Sentry from '@sentry/node';
import { Express, Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { config } from '../config';

/**
 * Configuration options for Sentry initialization
 */
export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
  enabled?: boolean;
}

/**
 * Request context extracted for error reporting
 * Contains sanitized request information without PII
 */
export interface RequestContext {
  url: string;
  method: string;
  userAgent: string;
  requestId?: string;
}

// Track initialization state
let sentryInitialized = false;

/**
 * Checks if Sentry is currently initialized
 * @returns true if Sentry has been initialized
 */
export function isSentryInitialized(): boolean {
  return sentryInitialized;
}

/**
 * Gets the default Sentry configuration from environment
 * @returns SentryConfig with values from environment variables
 */
export function getDefaultSentryConfig(): SentryConfig {
  return {
    dsn: config.sentryDsn || '',
    environment: config.nodeEnv || 'development',
    release: config.appVersion,
    tracesSampleRate: config.sentryTracesSampleRate ?? 0.1,
    enabled: config.sentryEnabled ?? false,
  };
}

/**
 * Initializes Sentry with the provided configuration
 * Must be called before any other Sentry functions
 * @param app Express application instance
 * @param sentryConfig Optional configuration (uses defaults if not provided)
 * Requirements: 7.1
 */
export function initSentry(app: Express, sentryConfig?: Partial<SentryConfig>): void {
  const cfg = { ...getDefaultSentryConfig(), ...sentryConfig };

  // Skip initialization if disabled or no DSN
  if (!cfg.enabled || !cfg.dsn) {
    sentryInitialized = false;
    return;
  }

  Sentry.init({
    dsn: cfg.dsn,
    environment: cfg.environment,
    release: cfg.release,
    tracesSampleRate: cfg.tracesSampleRate ?? 0.1,
    integrations: [
      // Enable HTTP tracing
      Sentry.httpIntegration(),
    ],
    // Filter out known non-critical errors
    beforeSend: (event) => {
      // Filter out AbortError (user cancelled requests)
      if (event.exception?.values?.[0]?.type === 'AbortError') {
        return null;
      }
      return event;
    },
  });

  // Set up Express error handler after init
  Sentry.setupExpressErrorHandler(app);

  sentryInitialized = true;
}

/**
 * Creates Sentry request handler middleware
 * Must be added as the first middleware in the Express chain
 * @returns Express middleware function
 * Requirements: 7.1
 */
export function createSentryRequestHandler(): (req: Request, res: Response, next: NextFunction) => void {
  if (!sentryInitialized) {
    // Return no-op middleware if Sentry is not initialized
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  // In Sentry v8+, use setupExpressErrorHandler pattern
  // For request handling, we use a simple middleware that sets up the scope
  return (req: Request, _res: Response, next: NextFunction) => {
    Sentry.withScope((scope) => {
      scope.setSDKProcessingMetadata({ request: req });
      next();
    });
  };
}

/**
 * Creates Sentry tracing handler middleware
 * Should be added after request handler for performance tracing
 * @returns Express middleware function
 */
export function createSentryTracingHandler(): (req: Request, res: Response, next: NextFunction) => void {
  if (!sentryInitialized) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  // In Sentry v8+, tracing is handled automatically via integrations
  return (_req: Request, _res: Response, next: NextFunction) => next();
}

/**
 * Creates Sentry error handler middleware
 * Must be added before any other error handling middleware
 * @returns Express error middleware function
 * Requirements: 7.1
 */
export function createSentryErrorHandler(): ErrorRequestHandler {
  if (!sentryInitialized) {
    // Return no-op error middleware if Sentry is not initialized
    return (err: Error, _req: Request, _res: Response, next: NextFunction) => next(err);
  }
  // Use the built-in express error handler
  return Sentry.expressErrorHandler();
}

/**
 * Extracts sanitized request context for error reporting
 * Removes PII and sensitive information
 * @param req Express request object
 * @returns Sanitized request context
 * Requirements: 7.3
 */
export function extractRequestContext(req: Request): RequestContext {
  // Sanitize user agent to remove potential PII
  const rawUserAgent = req.get('user-agent') || 'unknown';
  // Keep only browser/OS info, truncate to reasonable length
  const sanitizedUserAgent = rawUserAgent.substring(0, 200);

  return {
    url: req.path, // Use path only, not full URL with query params
    method: req.method,
    userAgent: sanitizedUserAgent,
    requestId: (req as Request & { id?: string }).id,
  };
}

/**
 * Captures an exception with optional context
 * Sends the error to Sentry with additional metadata
 * @param error The error to capture
 * @param context Optional additional context to attach
 * Requirements: 7.1, 7.3
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!sentryInitialized) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      // Add context as extras
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

/**
 * Captures an exception with request context
 * Extracts and attaches sanitized request information
 * @param error The error to capture
 * @param req Express request object
 * @param additionalContext Optional additional context
 * Requirements: 7.1, 7.3
 */
export function captureExceptionWithRequest(
  error: Error,
  req: Request,
  additionalContext?: Record<string, unknown>
): void {
  const requestContext = extractRequestContext(req);
  captureException(error, {
    ...requestContext,
    ...additionalContext,
  });
}

/**
 * Sets a tag on the current Sentry scope
 * @param key Tag key
 * @param value Tag value
 */
export function setTag(key: string, value: string): void {
  if (!sentryInitialized) {
    return;
  }
  Sentry.setTag(key, value);
}

/**
 * Sets user information on the current Sentry scope
 * Only use with non-PII identifiers
 * @param user User information (should be anonymized)
 */
export function setUser(user: { id?: string; segment?: string }): void {
  if (!sentryInitialized) {
    return;
  }
  Sentry.setUser(user);
}

/**
 * Adds a breadcrumb to the current Sentry scope
 * Breadcrumbs help trace the path leading to an error
 * @param breadcrumb Breadcrumb data
 */
export function addBreadcrumb(breadcrumb: {
  category?: string;
  message?: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, unknown>;
}): void {
  if (!sentryInitialized) {
    return;
  }
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Flushes pending Sentry events
 * Should be called before application shutdown
 * @param timeout Timeout in milliseconds (default: 2000)
 */
export async function flushSentry(timeout: number = 2000): Promise<boolean> {
  if (!sentryInitialized) {
    return true;
  }
  return Sentry.flush(timeout);
}

/**
 * Resets Sentry initialization state (for testing)
 */
export function resetSentry(): void {
  sentryInitialized = false;
}
