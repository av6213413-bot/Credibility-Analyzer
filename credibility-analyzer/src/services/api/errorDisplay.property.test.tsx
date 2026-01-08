/**
 * Feature: credibility-analyzer-frontend, Property 16: Error Response Display
 * Validates: Requirements 6.2
 *
 * For any backend error response, the Error_Boundary SHALL display the error message
 * and any suggested actions from the response.
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, within, cleanup } from '@testing-library/react';
import { ErrorDisplay } from '@/shared/components/ErrorBoundary/ErrorBoundary';
import type { APIError } from '@/types';

// Generator for realistic error messages (simple words joined by spaces)
const errorMessageArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom('Error', 'failed', 'connection', 'timeout', 'invalid', 'request', 'server', 'network', 'unavailable', 'retry'), { minLength: 2, maxLength: 5 })
  .map((words) => words.join(' '));

// Arbitrary generator for API error responses with realistic messages
const apiErrorArb: fc.Arbitrary<APIError> = fc.record({
  code: fc.constantFrom('TIMEOUT', 'NETWORK', 'HTTP_400', 'HTTP_500', 'INVALID_URL', 'CANCELLED'),
  message: errorMessageArb,
  suggestedAction: fc.option(errorMessageArb, { nil: undefined }),
});

// Convert APIError to Error object for ErrorDisplay component
const createErrorFromAPIError = (apiError: APIError): Error => {
  const error = new Error(apiError.message);
  error.name = apiError.code;
  return error;
};

describe('Property 16: Error Response Display', () => {
  afterEach(() => {
    cleanup();
  });

  it('should display error message for any API error response', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(apiErrorArb, (apiError) => {
        // Clean up before each iteration
        cleanup();

        const error = createErrorFromAPIError(apiError);
        const handleRetry = () => {};

        render(
          <ErrorDisplay
            error={error}
            suggestedAction={apiError.suggestedAction}
            onRetry={handleRetry}
          />
        );

        // Get the alert container
        const alertContainer = screen.getByRole('alert');

        // Error message should be displayed within the alert
        expect(within(alertContainer).getByText(apiError.message)).toBeInTheDocument();

        // If suggested action exists, it should be displayed
        if (apiError.suggestedAction) {
          expect(within(alertContainer).getByText(apiError.suggestedAction)).toBeInTheDocument();
        }

        // Retry button should always be present
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

        // Clean up after each iteration
        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  it('should display error alert role for accessibility', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(apiErrorArb, (apiError) => {
        // Clean up before each iteration
        cleanup();

        const error = createErrorFromAPIError(apiError);
        const handleRetry = () => {};

        render(
          <ErrorDisplay
            error={error}
            suggestedAction={apiError.suggestedAction}
            onRetry={handleRetry}
          />
        );

        // Should have alert role for accessibility
        expect(screen.getByRole('alert')).toBeInTheDocument();

        // Clean up after each iteration
        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  it('should handle errors with various code formats', { timeout: 30000 }, () => {
    // Test specific error codes that might come from the API
    const errorCodes = [
      'TIMEOUT',
      'NETWORK',
      'CANCELLED',
      'HTTP_400',
      'HTTP_401',
      'HTTP_403',
      'HTTP_404',
      'HTTP_500',
      'HTTP_502',
      'HTTP_503',
      'INVALID_URL',
      'RATE_LIMITED',
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...errorCodes),
        errorMessageArb,
        fc.option(errorMessageArb, { nil: undefined }),
        (code, message, suggestedAction) => {
          // Clean up before each iteration
          cleanup();

          const error = new Error(message);
          error.name = code;
          const handleRetry = () => {};

          render(
            <ErrorDisplay
              error={error}
              suggestedAction={suggestedAction}
              onRetry={handleRetry}
            />
          );

          // Get the alert container
          const alertContainer = screen.getByRole('alert');

          // Error message should always be displayed
          expect(within(alertContainer).getByText(message)).toBeInTheDocument();

          // Suggested action should be displayed if provided
          if (suggestedAction) {
            expect(within(alertContainer).getByText(suggestedAction)).toBeInTheDocument();
          }

          // Clean up after each iteration
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
