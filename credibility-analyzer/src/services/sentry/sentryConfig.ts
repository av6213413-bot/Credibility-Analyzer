/**
 * Sentry Configuration for React Frontend
 * Provides error tracking and performance monitoring
 * Requirements: 7.4
 */

import * as Sentry from '@sentry/react';

/**
 * Configuration options for Sentry initialization
 */
export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
  enabled?: boolean;
}

// Track initialization state
let sentryInitialized = false;

/**
 * Gets the default Sentry configuration from environment variables
 * @returns SentryConfig with values from Vite environment variables
 */
export function getDefaultSentryConfig(): SentryConfig {
  return {
    dsn: import.meta.env.VITE_SENTRY_DSN || '',
    environment: import.meta.env.VITE_APP_ENV || 'development',
    release: import.meta.env.VITE_APP_VERSION,
    tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    replaysSessionSampleRate: parseFloat(
      import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE || '0.1'
    ),
    replaysOnErrorSampleRate: parseFloat(
      import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE || '1.0'
    ),
    enabled: import.meta.env.VITE_SENTRY_ENABLED === 'true',
  };
}

/**
 * Checks if Sentry is currently initialized
 * @returns true if Sentry has been initialized
 */
export function isSentryInitialized(): boolean {
  return sentryInitialized;
}


/**
 * Initializes Sentry for the React application
 * Must be called before the React app renders
 * @param config Optional configuration (uses defaults if not provided)
 * Requirements: 7.4
 */
export function initSentry(config?: Partial<SentryConfig>): void {
  const cfg = { ...getDefaultSentryConfig(), ...config };

  // Skip initialization if disabled or no DSN
  if (!cfg.enabled || !cfg.dsn) {
    sentryInitialized = false;
    return;
  }

  Sentry.init({
    dsn: cfg.dsn,
    environment: cfg.environment,
    release: cfg.release,
    
    // Performance monitoring
    tracesSampleRate: cfg.tracesSampleRate ?? 0.1,
    
    // Session replay for debugging
    replaysSessionSampleRate: cfg.replaysSessionSampleRate ?? 0.1,
    replaysOnErrorSampleRate: cfg.replaysOnErrorSampleRate ?? 1.0,
    
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration(),
      // Session replay for debugging user sessions
      Sentry.replayIntegration({
        // Mask all text content for privacy
        maskAllText: true,
        // Block all media for privacy
        blockAllMedia: true,
      }),
    ],
    
    // Filter out known non-critical errors
    beforeSend: (event) => {
      // Filter out AbortError (user cancelled requests)
      if (event.exception?.values?.[0]?.type === 'AbortError') {
        return null;
      }
      // Filter out network errors that are expected
      if (event.exception?.values?.[0]?.type === 'NetworkError') {
        return null;
      }
      return event;
    },
  });

  sentryInitialized = true;
}

/**
 * Creates a Sentry error boundary wrapper component
 * Use this to wrap components that should report errors to Sentry
 * @returns Sentry ErrorBoundary component
 * Requirements: 7.4
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * Captures an exception with optional context
 * Sends the error to Sentry with additional metadata
 * @param error The error to capture
 * @param context Optional additional context to attach
 * Requirements: 7.4
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!sentryInitialized) {
    // Log to console if Sentry is not initialized
    console.error('Error captured (Sentry not initialized):', error, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

/**
 * Captures a message with optional context
 * @param message The message to capture
 * @param level The severity level
 * @param context Optional additional context
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, unknown>
): void {
  if (!sentryInitialized) {
    console.log(`Message captured (Sentry not initialized): [${level}] ${message}`, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureMessage(message, level);
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
 * Resets Sentry initialization state (for testing)
 */
export function resetSentry(): void {
  sentryInitialized = false;
}
