/**
 * Backoff Utilities
 * 
 * Utility functions for calculating retry delays.
 * Separated to avoid circular dependencies.
 * 
 * Requirements: 10.5
 */

/**
 * Calculate exponential backoff delay for a given attempt number
 * Formula: delay = baseDelay * 2^(attemptNumber - 1)
 * 
 * @param baseDelay - Base delay in milliseconds
 * @param attemptNumber - Current attempt number (1-based)
 * @returns Calculated delay in milliseconds
 */
export function calculateExponentialBackoff(baseDelay: number, attemptNumber: number): number {
  if (attemptNumber < 1) {
    return baseDelay;
  }
  return baseDelay * Math.pow(2, attemptNumber - 1);
}
