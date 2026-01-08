import { describe, it } from 'vitest';
import * as fc from 'fast-check';

// Import from backoffUtils to avoid circular dependency
import { calculateExponentialBackoff } from './backoffUtils';

/**
 * Property-based tests for Queue Configuration
 * Feature: cicd-pipeline
 */
describe('Queue Configuration Property Tests', () => {
  /**
   * Feature: cicd-pipeline, Property 4: Job Retry Exponential Backoff
   * 
   * For any failed job with attempts < maxAttempts, the retry delay SHALL follow
   * exponential backoff pattern: delay = baseDelay * 2^(attemptNumber - 1).
   * 
   * **Validates: Requirements 10.5**
   */
  describe('Property 4: Job Retry Exponential Backoff', () => {
    /**
     * Property: For any base delay and attempt number, the calculated delay
     * should follow the formula: delay = baseDelay * 2^(attemptNumber - 1)
     */
    it('should calculate correct exponential backoff for any valid inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 10000 }), // baseDelay in ms
          fc.integer({ min: 1, max: 10 }),       // attemptNumber
          (baseDelay, attemptNumber) => {
            const calculatedDelay = calculateExponentialBackoff(baseDelay, attemptNumber);
            const expectedDelay = baseDelay * Math.pow(2, attemptNumber - 1);
            
            return calculatedDelay === expectedDelay;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: First attempt should always return the base delay
     */
    it('should return base delay for first attempt', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100000 }), // baseDelay in ms
          (baseDelay) => {
            const calculatedDelay = calculateExponentialBackoff(baseDelay, 1);
            return calculatedDelay === baseDelay;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Each subsequent attempt should double the delay
     */
    it('should double delay for each subsequent attempt', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 10000 }), // baseDelay in ms
          fc.integer({ min: 1, max: 9 }),        // attemptNumber (max 9 to allow +1)
          (baseDelay, attemptNumber) => {
            const currentDelay = calculateExponentialBackoff(baseDelay, attemptNumber);
            const nextDelay = calculateExponentialBackoff(baseDelay, attemptNumber + 1);
            
            return nextDelay === currentDelay * 2;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Delay should always be positive for valid inputs
     */
    it('should always return positive delay for positive inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100000 }), // baseDelay in ms
          fc.integer({ min: 1, max: 20 }),      // attemptNumber
          (baseDelay, attemptNumber) => {
            const calculatedDelay = calculateExponentialBackoff(baseDelay, attemptNumber);
            return calculatedDelay > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Delay should be monotonically increasing with attempt number
     */
    it('should increase monotonically with attempt number', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 10000 }), // baseDelay in ms
          fc.integer({ min: 1, max: 8 }),        // attemptNumber
          (baseDelay, attemptNumber) => {
            const delay1 = calculateExponentialBackoff(baseDelay, attemptNumber);
            const delay2 = calculateExponentialBackoff(baseDelay, attemptNumber + 1);
            const delay3 = calculateExponentialBackoff(baseDelay, attemptNumber + 2);
            
            return delay1 < delay2 && delay2 < delay3;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: For attempt 0 or negative, should return base delay
     */
    it('should handle edge case of attempt 0 or negative', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }), // baseDelay in ms
          fc.integer({ min: -10, max: 0 }),    // attemptNumber (0 or negative)
          (baseDelay, attemptNumber) => {
            const calculatedDelay = calculateExponentialBackoff(baseDelay, attemptNumber);
            // For attempt <= 0, should return baseDelay
            return calculatedDelay === baseDelay;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
