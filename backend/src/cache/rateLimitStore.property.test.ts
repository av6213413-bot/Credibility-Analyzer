/**
 * Property-based tests for Redis Rate Limit Store Fallback
 * Feature: infrastructure-deployment, Property 5: Redis Fallback on Unavailability
 * Validates: Requirements 7.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { RedisRateLimitStore, InMemoryStore } from './rateLimitStore';
import { redisClient } from './redisClient';

/**
 * Property 5: Redis Fallback on Unavailability
 * 
 * For any rate limit check when Redis is unavailable, the API SHALL fall back
 * to in-memory rate limiting and continue processing requests without error.
 * 
 * Validates: Requirements 7.5
 */
describe('Rate Limit Store Fallback Properties', () => {
  describe('InMemoryStore', () => {
    let memoryStore: InMemoryStore;

    beforeEach(() => {
      memoryStore = new InMemoryStore();
    });

    afterEach(() => {
      memoryStore.shutdown();
    });

    /**
     * Property: For any key and window, increment should return valid rate limit info
     */
    it('should return valid rate limit info for any increment', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // Use UUID to ensure unique keys per iteration
          fc.integer({ min: 1000, max: 3600000 }), // 1 second to 1 hour in ms
          (key, windowMs) => {
            const result = memoryStore.increment(key, windowMs);
            
            expect(result.totalHits).toBe(1);
            expect(result.resetTime).toBeInstanceOf(Date);
            expect(result.resetTime.getTime()).toBeGreaterThan(Date.now());
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Multiple increments should increase hit count
     */
    it('should increase hit count for multiple increments on same key', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // Use UUID to ensure unique keys per iteration
          fc.integer({ min: 1000, max: 3600000 }),
          fc.integer({ min: 2, max: 10 }),
          (key, windowMs, numIncrements) => {
            let lastResult;
            for (let i = 0; i < numIncrements; i++) {
              lastResult = memoryStore.increment(key, windowMs);
            }
            
            expect(lastResult!.totalHits).toBe(numIncrements);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Decrement should reduce hit count but not below 0
     */
    it('should decrement hit count but not below zero', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // Use UUID to ensure unique keys per iteration
          fc.integer({ min: 1000, max: 3600000 }),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 10 }),
          (key, windowMs, increments, decrements) => {
            // Increment first
            for (let i = 0; i < increments; i++) {
              memoryStore.increment(key, windowMs);
            }
            
            // Decrement
            for (let i = 0; i < decrements; i++) {
              memoryStore.decrement(key);
            }
            
            const result = memoryStore.get(key);
            if (result) {
              expect(result.totalHits).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Reset should remove the key
     */
    it('should remove key after reset', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // Use UUID to ensure unique keys per iteration
          fc.integer({ min: 1000, max: 3600000 }),
          (key, windowMs) => {
            memoryStore.increment(key, windowMs);
            memoryStore.resetKey(key);
            
            const result = memoryStore.get(key);
            expect(result).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Property 5: Redis Fallback on Unavailability', () => {
    /**
     * Property 5: Redis Fallback on Unavailability
     * 
     * For any rate limit check when Redis is unavailable, the API SHALL fall back
     * to in-memory rate limiting and continue processing requests without error.
     * 
     * Validates: Requirements 7.5
     */

    let store: RedisRateLimitStore;

    beforeEach(() => {
      store = new RedisRateLimitStore(60000, 'test:rl:');
    });

    afterEach(() => {
      store.shutdown();
    });

    /**
     * Property: When Redis is unavailable, increment should still work via fallback
     */
    it('should fall back to in-memory when Redis is unavailable', async () => {
      // Ensure Redis is disconnected for this test
      if (redisClient.isConnected()) {
        await redisClient.disconnect();
      }

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Use UUID to ensure unique keys per iteration
          async (key) => {
            // Should not throw and should return valid response
            const result = await store.increment(key);
            
            expect(result.totalHits).toBeGreaterThanOrEqual(1);
            expect(result.resetTime).toBeDefined();
            if (result.resetTime) {
              expect(result.resetTime).toBeInstanceOf(Date);
              expect(result.resetTime.getTime()).toBeGreaterThan(Date.now());
            }
            
            // Should be using fallback mode
            expect(store.isUsingFallback()).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Fallback should maintain rate limit state correctly
     */
    it('should maintain rate limit state in fallback mode', async () => {
      // Ensure Redis is disconnected
      if (redisClient.isConnected()) {
        await redisClient.disconnect();
      }

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Use UUID to ensure unique keys per iteration
          fc.integer({ min: 2, max: 10 }),
          async (key, numRequests) => {
            // Make multiple requests
            let lastResult;
            for (let i = 0; i < numRequests; i++) {
              lastResult = await store.increment(key);
            }
            
            // Hit count should match number of requests
            expect(lastResult!.totalHits).toBe(numRequests);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Decrement should work in fallback mode
     */
    it('should support decrement in fallback mode', async () => {
      // Ensure Redis is disconnected
      if (redisClient.isConnected()) {
        await redisClient.disconnect();
      }

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Use UUID to ensure unique keys per iteration
          async (key) => {
            // Increment twice
            await store.increment(key);
            await store.increment(key);
            
            // Decrement once - should not throw
            await expect(store.decrement(key)).resolves.not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Reset should work in fallback mode
     */
    it('should support resetKey in fallback mode', async () => {
      // Ensure Redis is disconnected
      if (redisClient.isConnected()) {
        await redisClient.disconnect();
      }

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Use UUID to ensure unique keys per iteration
          async (key) => {
            // Increment
            await store.increment(key);
            
            // Reset - should not throw
            await expect(store.resetKey(key)).resolves.not.toThrow();
            
            // Next increment should start fresh
            const result = await store.increment(key);
            expect(result.totalHits).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Get should work in fallback mode
     */
    it('should support get in fallback mode', async () => {
      // Ensure Redis is disconnected
      if (redisClient.isConnected()) {
        await redisClient.disconnect();
      }

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Use UUID to ensure unique keys per iteration
          fc.integer({ min: 1, max: 5 }),
          async (key, numIncrements) => {
            // Increment multiple times
            for (let i = 0; i < numIncrements; i++) {
              await store.increment(key);
            }
            
            // Get should return the current state
            const result = await store.get(key);
            expect(result).toBeDefined();
            expect(result!.totalHits).toBe(numIncrements);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Different keys should have independent rate limits in fallback
     */
    it('should maintain independent rate limits per key in fallback mode', async () => {
      // Ensure Redis is disconnected
      if (redisClient.isConnected()) {
        await redisClient.disconnect();
      }

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Use UUID to ensure unique keys per iteration
          fc.uuid(), // Use UUID to ensure unique keys per iteration
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          async (key1, key2, count1, count2) => {
            // Skip if keys are the same
            if (key1 === key2) return;
            
            // Increment key1
            let result1;
            for (let i = 0; i < count1; i++) {
              result1 = await store.increment(key1);
            }
            
            // Increment key2
            let result2;
            for (let i = 0; i < count2; i++) {
              result2 = await store.increment(key2);
            }
            
            // Each key should have its own count
            expect(result1!.totalHits).toBe(count1);
            expect(result2!.totalHits).toBe(count2);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Fallback should continue processing without errors
     */
    it('should continue processing requests without error in fallback mode', async () => {
      // Ensure Redis is disconnected
      if (redisClient.isConnected()) {
        await redisClient.disconnect();
      }

      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }), // Use UUIDs for unique keys
          async (keys) => {
            // Process multiple requests for different keys
            const results = await Promise.all(
              keys.map(key => store.increment(key))
            );
            
            // All requests should succeed
            results.forEach(result => {
              expect(result.totalHits).toBeGreaterThanOrEqual(1);
              if (result.resetTime) {
                expect(result.resetTime).toBeInstanceOf(Date);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('RedisRateLimitStore initialization', () => {
    /**
     * Property: Store should initialize with valid window and prefix
     */
    it('should initialize with valid configuration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 3600000 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (windowMs, prefix) => {
            const store = new RedisRateLimitStore(windowMs, prefix);
            
            // Should not throw during creation
            expect(store).toBeInstanceOf(RedisRateLimitStore);
            
            // Cleanup
            store.shutdown();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: isRedisAvailable should reflect actual Redis connection state
     */
    it('should correctly report Redis availability', async () => {
      const store = new RedisRateLimitStore(60000, 'test:');
      
      // When Redis is disconnected
      if (redisClient.isConnected()) {
        await redisClient.disconnect();
      }
      
      expect(store.isRedisAvailable()).toBe(false);
      
      store.shutdown();
    });
  });
});
