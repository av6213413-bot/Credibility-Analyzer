/**
 * Cache Service Module
 * Provides caching operations with configurable TTL for analysis results
 * Requirements: 7.3, 7.4, 4.1
 */

import { redisClient } from './redisClient';
import { logger } from '../utils/logger';
import { getMetricsService } from '../monitoring';
import type { AnalysisResult } from '../types';

/**
 * Default cache TTL in seconds (1 hour)
 * Requirement 7.4: The default cache TTL SHALL be 1 hour (3600 seconds)
 */
export const DEFAULT_CACHE_TTL_SECONDS = 3600;

/**
 * Cache key patterns for different data types
 */
export const CacheKeyPatterns = {
  /**
   * Analysis result cache key pattern: analysis:{id}
   */
  analysisResult: (id: string): string => `analysis:${id}`,

  /**
   * Rate limit cache key pattern: ratelimit:{ip}:{window}
   */
  rateLimit: (ip: string, window: number): string => `ratelimit:${ip}:${window}`,

  /**
   * ML service health cache key
   */
  mlHealth: (): string => 'health:ml',
};

/**
 * Cache service interface
 */
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getTtl(key: string): Promise<number>;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  defaultTtlSeconds: number;
}

/**
 * Parses cache configuration from environment variables
 */
export function parseCacheConfig(env: NodeJS.ProcessEnv = process.env): CacheConfig {
  const ttl = env.REDIS_CACHE_TTL
    ? parseInt(env.REDIS_CACHE_TTL, 10)
    : DEFAULT_CACHE_TTL_SECONDS;

  return {
    defaultTtlSeconds: isNaN(ttl) || ttl < 0 ? DEFAULT_CACHE_TTL_SECONDS : ttl,
  };
}

/**
 * Records a cache hit in metrics
 * Requirement 4.1: THE Cache_Service SHALL expose hit and miss counters via metrics endpoint
 */
export function recordCacheHit(): void {
  try {
    const metrics = getMetricsService();
    metrics.cacheHitsTotal.inc();
  } catch {
    // Silently ignore metrics errors to not break the application
    logger.debug('Failed to record cache hit metric');
  }
}

/**
 * Records a cache miss in metrics
 * Requirement 4.1: THE Cache_Service SHALL expose hit and miss counters via metrics endpoint
 */
export function recordCacheMiss(): void {
  try {
    const metrics = getMetricsService();
    metrics.cacheMissesTotal.inc();
  } catch {
    // Silently ignore metrics errors to not break the application
    logger.debug('Failed to record cache miss metric');
  }
}


/**
 * Cache Service implementation using Redis
 */
class CacheServiceImpl implements CacheService {
  private config: CacheConfig;

  constructor(config?: CacheConfig) {
    this.config = config || parseCacheConfig();
  }

  /**
   * Gets a value from the cache
   * @param key - The cache key
   * @returns The cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    if (!redisClient.isConnected()) {
      logger.debug('Cache get skipped - Redis not connected', { key });
      recordCacheMiss();
      return null;
    }

    try {
      const client = redisClient.getClient();
      const value = await client.get(key);

      if (value === null) {
        logger.debug('Cache miss', { key });
        recordCacheMiss();
        return null;
      }

      logger.debug('Cache hit', { key });
      recordCacheHit();
      return JSON.parse(value) as T;
    } catch (error) {
      logger.warn('Cache get failed', { key, error });
      recordCacheMiss();
      return null;
    }
  }

  /**
   * Sets a value in the cache with optional TTL
   * Requirement 7.3: THE API_Server SHALL cache ML analysis results in Redis with configurable TTL
   * @param key - The cache key
   * @param value - The value to cache
   * @param ttlSeconds - TTL in seconds (defaults to configured default)
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!redisClient.isConnected()) {
      logger.debug('Cache set skipped - Redis not connected', { key });
      return;
    }

    const ttl = ttlSeconds ?? this.config.defaultTtlSeconds;

    try {
      const client = redisClient.getClient();
      const serialized = JSON.stringify(value);

      // Use SETEX to set value with expiration atomically
      await client.setex(key, ttl, serialized);

      logger.debug('Cache set', { key, ttlSeconds: ttl });
    } catch (error) {
      logger.warn('Cache set failed', { key, error });
    }
  }

  /**
   * Deletes a value from the cache
   * @param key - The cache key to delete
   */
  async delete(key: string): Promise<void> {
    if (!redisClient.isConnected()) {
      logger.debug('Cache delete skipped - Redis not connected', { key });
      return;
    }

    try {
      const client = redisClient.getClient();
      await client.del(key);
      logger.debug('Cache delete', { key });
    } catch (error) {
      logger.warn('Cache delete failed', { key, error });
    }
  }

  /**
   * Checks if a key exists in the cache
   * @param key - The cache key to check
   * @returns true if the key exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    if (!redisClient.isConnected()) {
      logger.debug('Cache exists skipped - Redis not connected', { key });
      return false;
    }

    try {
      const client = redisClient.getClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.warn('Cache exists check failed', { key, error });
      return false;
    }
  }

  /**
   * Gets the remaining TTL for a key in seconds
   * @param key - The cache key
   * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  async getTtl(key: string): Promise<number> {
    if (!redisClient.isConnected()) {
      logger.debug('Cache getTtl skipped - Redis not connected', { key });
      return -2;
    }

    try {
      const client = redisClient.getClient();
      return await client.ttl(key);
    } catch (error) {
      logger.warn('Cache getTtl failed', { key, error });
      return -2;
    }
  }

  /**
   * Gets the configured default TTL
   */
  getDefaultTtl(): number {
    return this.config.defaultTtlSeconds;
  }

  /**
   * Updates the cache configuration
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton instance
export const cacheService = new CacheServiceImpl();

// Export class for testing
export { CacheServiceImpl };

/**
 * Helper functions for caching analysis results
 */

/**
 * Caches an analysis result
 * @param result - The analysis result to cache
 * @param ttlSeconds - Optional TTL override
 */
export async function cacheAnalysisResult(
  result: AnalysisResult,
  ttlSeconds?: number
): Promise<void> {
  const key = CacheKeyPatterns.analysisResult(result.id);
  await cacheService.set(key, result, ttlSeconds);
}

/**
 * Retrieves a cached analysis result
 * @param id - The analysis result ID
 * @returns The cached result or null
 */
export async function getCachedAnalysisResult(
  id: string
): Promise<AnalysisResult | null> {
  const key = CacheKeyPatterns.analysisResult(id);
  return cacheService.get<AnalysisResult>(key);
}

/**
 * Invalidates a cached analysis result
 * @param id - The analysis result ID to invalidate
 */
export async function invalidateCachedAnalysisResult(id: string): Promise<void> {
  const key = CacheKeyPatterns.analysisResult(id);
  await cacheService.delete(key);
}
