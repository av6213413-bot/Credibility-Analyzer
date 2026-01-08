/**
 * Property-based tests for Cache Service TTL
 * Feature: infrastructure-deployment, Property 4: Redis Cache TTL Application
 * Validates: Requirements 7.3
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  CacheServiceImpl,
  CacheKeyPatterns,
  DEFAULT_CACHE_TTL_SECONDS,
  parseCacheConfig,
  recordCacheHit,
  recordCacheMiss,
} from './cacheService';
import { redisClient } from './redisClient';
import { resetMetricsService, getMetricsService } from '../monitoring';

/**
 * These tests require a running Redis instance.
 * They verify Property 4: Redis Cache TTL Application
 * 
 * For any cached analysis result, the cache entry SHALL have a TTL
 * equal to the configured cacheTtlSeconds value (default 3600).
 */
describe('Cache Service TTL Properties', () => {
  const REDIS_TEST_URI = process.env.REDIS_URI || 'redis://localhost:6379';
  let isRedisAvailable = false;

  beforeAll(async () => {
    // Try to connect to Redis for integration tests
    try {
      await redisClient.connect({
        uri: REDIS_TEST_URI,
        tls: false,
        clusterMode: false,
        retryDelayMs: 100,
        maxRetries: 2,
      });
      isRedisAvailable = redisClient.isConnected();
    } catch {
      isRedisAvailable = false;
    }
  });

  afterAll(async () => {
    if (isRedisAvailable && redisClient.isConnected()) {
      try {
        await redisClient.disconnect();
      } catch {
        // Ignore disconnect errors during cleanup
      }
    }
  });

  beforeEach(async () => {
    // Clean up test keys before each test
    if (isRedisAvailable) {
      const client = redisClient.getClient();
      const keys = await client.keys('test:*');
      if (keys.length > 0) {
        await client.del(...keys);
      }
    }
  });

  describe('parseCacheConfig', () => {
    /**
     * Property: Default TTL is 3600 seconds when not configured
     */
    it('should use default TTL of 3600 seconds when REDIS_CACHE_TTL is not set', () => {
      const config = parseCacheConfig({});
      expect(config.defaultTtlSeconds).toBe(DEFAULT_CACHE_TTL_SECONDS);
      expect(config.defaultTtlSeconds).toBe(3600);
    });

    /**
     * Property: For any valid positive TTL value, the config should use that value
     */
    it('should parse valid positive TTL values from environment', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 86400 }), // 1 second to 24 hours
          (ttl) => {
            const config = parseCacheConfig({ REDIS_CACHE_TTL: String(ttl) });
            expect(config.defaultTtlSeconds).toBe(ttl);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Invalid TTL values should fall back to default
     */
    it('should use default TTL for invalid values', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('invalid', '', 'abc', '-1', 'NaN'),
          (invalidValue) => {
            const config = parseCacheConfig({ REDIS_CACHE_TTL: invalidValue });
            expect(config.defaultTtlSeconds).toBe(DEFAULT_CACHE_TTL_SECONDS);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Negative TTL values should fall back to default
     */
    it('should use default TTL for negative values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: -1 }),
          (negativeTtl) => {
            const config = parseCacheConfig({ REDIS_CACHE_TTL: String(negativeTtl) });
            expect(config.defaultTtlSeconds).toBe(DEFAULT_CACHE_TTL_SECONDS);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('CacheKeyPatterns', () => {
    /**
     * Property: Analysis result keys follow the pattern analysis:{id}
     */
    it('should generate correct analysis result cache keys', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (id) => {
            const key = CacheKeyPatterns.analysisResult(id);
            expect(key).toBe(`analysis:${id}`);
            expect(key.startsWith('analysis:')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Rate limit keys follow the pattern ratelimit:{ip}:{window}
     */
    it('should generate correct rate limit cache keys', () => {
      fc.assert(
        fc.property(
          fc.ipV4(),
          fc.integer({ min: 1000, max: 3600000 }),
          (ip, window) => {
            const key = CacheKeyPatterns.rateLimit(ip, window);
            expect(key).toBe(`ratelimit:${ip}:${window}`);
            expect(key.startsWith('ratelimit:')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: ML health key is constant
     */
    it('should generate constant ML health cache key', () => {
      const key = CacheKeyPatterns.mlHealth();
      expect(key).toBe('health:ml');
    });
  });


  describe('Property 4: Redis Cache TTL Application', () => {
    /**
     * Property 4: Redis Cache TTL Application
     * For any cached analysis result, the cache entry SHALL have a TTL
     * equal to the configured cacheTtlSeconds value (default 3600).
     * Validates: Requirements 7.3
     */

    it('should apply default TTL (3600 seconds) when no TTL is specified', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping Redis integration test - Redis not available');
        return;
      }

      const cacheServiceWithDefault = new CacheServiceImpl({
        defaultTtlSeconds: DEFAULT_CACHE_TTL_SECONDS,
      });

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.integer({ min: 0, max: 100 }),
          }),
          async (id, data) => {
            const key = `test:ttl:${id}`;

            // Set value without explicit TTL (should use default)
            await cacheServiceWithDefault.set(key, data);

            // Check TTL is approximately the default (within 5 seconds tolerance)
            const ttl = await cacheServiceWithDefault.getTtl(key);
            
            // TTL should be close to default (allowing for test execution time)
            expect(ttl).toBeGreaterThan(DEFAULT_CACHE_TTL_SECONDS - 5);
            expect(ttl).toBeLessThanOrEqual(DEFAULT_CACHE_TTL_SECONDS);

            // Cleanup
            await cacheServiceWithDefault.delete(key);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply custom TTL when specified', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping Redis integration test - Redis not available');
        return;
      }

      const cacheServiceWithDefault = new CacheServiceImpl({
        defaultTtlSeconds: DEFAULT_CACHE_TTL_SECONDS,
      });

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 10, max: 300 }), // Custom TTL between 10-300 seconds
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.integer({ min: 0, max: 100 }),
          }),
          async (id, customTtl, data) => {
            const key = `test:customttl:${id}`;

            // Set value with explicit custom TTL
            await cacheServiceWithDefault.set(key, data, customTtl);

            // Check TTL matches the custom value (within 5 seconds tolerance)
            const ttl = await cacheServiceWithDefault.getTtl(key);
            
            expect(ttl).toBeGreaterThan(customTtl - 5);
            expect(ttl).toBeLessThanOrEqual(customTtl);

            // Cleanup
            await cacheServiceWithDefault.delete(key);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply configured default TTL from CacheConfig', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping Redis integration test - Redis not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 60, max: 600 }), // Config TTL between 60-600 seconds
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.integer({ min: 0, max: 100 }),
          }),
          async (id, configTtl, data) => {
            // Create cache service with custom default TTL
            const customCacheService = new CacheServiceImpl({
              defaultTtlSeconds: configTtl,
            });

            const key = `test:configttl:${id}`;

            // Set value without explicit TTL (should use config default)
            await customCacheService.set(key, data);

            // Check TTL matches the configured default (within 5 seconds tolerance)
            const ttl = await customCacheService.getTtl(key);
            
            expect(ttl).toBeGreaterThan(configTtl - 5);
            expect(ttl).toBeLessThanOrEqual(configTtl);

            // Cleanup
            await customCacheService.delete(key);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly round-trip cached values with TTL', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping Redis integration test - Redis not available');
        return;
      }

      const cacheServiceWithDefault = new CacheServiceImpl({
        defaultTtlSeconds: 300, // 5 minutes for test
      });

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.record({
            id: fc.uuid(),
            score: fc.integer({ min: 0, max: 100 }),
            timestamp: fc.date().map(d => d.toISOString()),
            overview: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          async (cacheId, analysisData) => {
            const key = `test:roundtrip:${cacheId}`;

            // Set value
            await cacheServiceWithDefault.set(key, analysisData);

            // Get value back
            const retrieved = await cacheServiceWithDefault.get(key);

            // Verify round-trip
            expect(retrieved).toEqual(analysisData);

            // Verify TTL is set
            const ttl = await cacheServiceWithDefault.getTtl(key);
            expect(ttl).toBeGreaterThan(0);

            // Cleanup
            await cacheServiceWithDefault.delete(key);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cache operations without Redis', () => {
    /**
     * Property: Cache operations should gracefully handle disconnected state
     */
    it('should return null/false for operations when Redis is not connected', async () => {
      // Create a new cache service instance that won't be connected
      const disconnectedService = new CacheServiceImpl({
        defaultTtlSeconds: 3600,
      });

      // Temporarily disconnect if connected
      const wasConnected = redisClient.isConnected();
      if (wasConnected) {
        try {
          await redisClient.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      }

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.jsonValue(),
          async (id, value) => {
            const key = `test:disconnected:${id}`;

            // All operations should gracefully handle disconnected state
            const getResult = await disconnectedService.get(key);
            expect(getResult).toBeNull();

            // Set should not throw
            await expect(disconnectedService.set(key, value)).resolves.not.toThrow();

            // Exists should return false
            const existsResult = await disconnectedService.exists(key);
            expect(existsResult).toBe(false);

            // Delete should not throw
            await expect(disconnectedService.delete(key)).resolves.not.toThrow();

            // getTtl should return -2 (key doesn't exist / not connected)
            const ttlResult = await disconnectedService.getTtl(key);
            expect(ttlResult).toBe(-2);
          }
        ),
        { numRuns: 100 }
      );

      // Reconnect if it was connected before
      if (wasConnected) {
        try {
          await redisClient.connect({
            uri: REDIS_TEST_URI,
            tls: false,
            clusterMode: false,
            retryDelayMs: 100,
            maxRetries: 2,
          });
        } catch {
          // Ignore reconnect errors - test cleanup will handle it
        }
      }
    });
  });
});

/**
 * Property 4: Cache Hit Rate Calculation
 * Feature: monitoring-maintenance
 * Validates: Requirements 4.1, 4.2
 * 
 * For any combination of cache hits and misses where total operations > 0,
 * the cache hit rate SHALL equal hits / (hits + misses), expressed as a
 * value between 0 and 1.
 */
describe('Property 4: Cache Hit Rate Calculation', () => {
  beforeEach(() => {
    resetMetricsService();
  });

  /**
   * Property: recordCacheHit should increment cache_hits_total by exactly 1
   */
  it('should increment cache_hits_total by exactly 1 for each hit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        async (hitCount) => {
          resetMetricsService();
          const metrics = getMetricsService();

          // Record hits
          for (let i = 0; i < hitCount; i++) {
            recordCacheHit();
          }

          const metricsOutput = await metrics.getMetrics();
          const match = metricsOutput.match(/cache_hits_total\s+(\d+)/);
          const actualCount = match ? parseInt(match[1], 10) : 0;

          expect(actualCount).toBe(hitCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: recordCacheMiss should increment cache_misses_total by exactly 1
   */
  it('should increment cache_misses_total by exactly 1 for each miss', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        async (missCount) => {
          resetMetricsService();
          const metrics = getMetricsService();

          // Record misses
          for (let i = 0; i < missCount; i++) {
            recordCacheMiss();
          }

          const metricsOutput = await metrics.getMetrics();
          const match = metricsOutput.match(/cache_misses_total\s+(\d+)/);
          const actualCount = match ? parseInt(match[1], 10) : 0;

          expect(actualCount).toBe(missCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cache hit rate calculation should be hits / (hits + misses)
   * For any combination of hits and misses, the calculated hit rate should
   * equal hits / (hits + misses), expressed as a value between 0 and 1.
   */
  it('should correctly calculate cache hit rate as hits / (hits + misses)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        async (hits, misses) => {
          // Skip if both are 0 (division by zero)
          if (hits === 0 && misses === 0) {
            return;
          }

          resetMetricsService();
          const metrics = getMetricsService();

          // Record hits
          for (let i = 0; i < hits; i++) {
            recordCacheHit();
          }

          // Record misses
          for (let i = 0; i < misses; i++) {
            recordCacheMiss();
          }

          const metricsOutput = await metrics.getMetrics();

          // Extract hit count
          const hitMatch = metricsOutput.match(/cache_hits_total\s+(\d+)/);
          const actualHits = hitMatch ? parseInt(hitMatch[1], 10) : 0;

          // Extract miss count
          const missMatch = metricsOutput.match(/cache_misses_total\s+(\d+)/);
          const actualMisses = missMatch ? parseInt(missMatch[1], 10) : 0;

          // Verify counts
          expect(actualHits).toBe(hits);
          expect(actualMisses).toBe(misses);

          // Calculate expected hit rate
          const expectedHitRate = hits / (hits + misses);

          // Calculate actual hit rate from metrics
          const actualHitRate = actualHits / (actualHits + actualMisses);

          // Hit rate should be between 0 and 1
          expect(actualHitRate).toBeGreaterThanOrEqual(0);
          expect(actualHitRate).toBeLessThanOrEqual(1);

          // Hit rate should match expected
          expect(actualHitRate).toBeCloseTo(expectedHitRate, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cache metrics should accumulate correctly over multiple operations
   */
  it('should accumulate cache metrics correctly over multiple operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 50 }),
        async (operations) => {
          resetMetricsService();
          const metrics = getMetricsService();

          let expectedHits = 0;
          let expectedMisses = 0;

          // Record operations (true = hit, false = miss)
          for (const isHit of operations) {
            if (isHit) {
              recordCacheHit();
              expectedHits++;
            } else {
              recordCacheMiss();
              expectedMisses++;
            }
          }

          const metricsOutput = await metrics.getMetrics();

          // Extract counts
          const hitMatch = metricsOutput.match(/cache_hits_total\s+(\d+)/);
          const actualHits = hitMatch ? parseInt(hitMatch[1], 10) : 0;

          const missMatch = metricsOutput.match(/cache_misses_total\s+(\d+)/);
          const actualMisses = missMatch ? parseInt(missMatch[1], 10) : 0;

          // Verify accumulated counts
          expect(actualHits).toBe(expectedHits);
          expect(actualMisses).toBe(expectedMisses);

          // Verify total operations
          expect(actualHits + actualMisses).toBe(operations.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cache hit rate should be 1 when all operations are hits
   */
  it('should have hit rate of 1 when all operations are hits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        async (hitCount) => {
          resetMetricsService();
          const metrics = getMetricsService();

          // Record only hits
          for (let i = 0; i < hitCount; i++) {
            recordCacheHit();
          }

          const metricsOutput = await metrics.getMetrics();

          const hitMatch = metricsOutput.match(/cache_hits_total\s+(\d+)/);
          const actualHits = hitMatch ? parseInt(hitMatch[1], 10) : 0;

          // Miss count should be 0 (not present or 0)
          const missMatch = metricsOutput.match(/cache_misses_total\s+(\d+)/);
          const actualMisses = missMatch ? parseInt(missMatch[1], 10) : 0;

          // Hit rate should be 1 (100%)
          const hitRate = actualHits / (actualHits + actualMisses);
          expect(hitRate).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cache hit rate should be 0 when all operations are misses
   */
  it('should have hit rate of 0 when all operations are misses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        async (missCount) => {
          resetMetricsService();
          const metrics = getMetricsService();

          // Record only misses
          for (let i = 0; i < missCount; i++) {
            recordCacheMiss();
          }

          const metricsOutput = await metrics.getMetrics();

          // Hit count should be 0 (not present or 0)
          const hitMatch = metricsOutput.match(/cache_hits_total\s+(\d+)/);
          const actualHits = hitMatch ? parseInt(hitMatch[1], 10) : 0;

          const missMatch = metricsOutput.match(/cache_misses_total\s+(\d+)/);
          const actualMisses = missMatch ? parseInt(missMatch[1], 10) : 0;

          // Hit rate should be 0 (0%)
          const hitRate = actualHits / (actualHits + actualMisses);
          expect(hitRate).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
