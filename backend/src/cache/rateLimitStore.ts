/**
 * Redis-backed Rate Limit Store
 * Implements express-rate-limit store interface with Redis backend
 * Falls back to in-memory when Redis is unavailable
 * Requirements: 7.2, 7.5
 */

import type { Store, Options, IncrementResponse } from 'express-rate-limit';
import { redisClient } from './redisClient';
import { logger } from '../utils/logger';

/**
 * Rate limit info returned by the store
 */
export interface RateLimitInfo {
  totalHits: number;
  resetTime: Date;
}

/**
 * In-memory store entry
 */
interface MemoryStoreEntry {
  totalHits: number;
  resetTime: Date;
}

/**
 * In-memory fallback store for when Redis is unavailable
 * Requirement 7.5: WHEN Redis is unavailable, THE API_Server SHALL fall back to in-memory rate limiting
 */
class InMemoryStore {
  private store: Map<string, MemoryStoreEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Increments the hit count for a key
   */
  increment(key: string, windowMs: number): RateLimitInfo {
    const now = Date.now();
    const resetTime = new Date(now + windowMs);
    
    const existing = this.store.get(key);
    
    if (existing && existing.resetTime.getTime() > now) {
      // Entry exists and hasn't expired
      existing.totalHits += 1;
      return {
        totalHits: existing.totalHits,
        resetTime: existing.resetTime,
      };
    }
    
    // Create new entry
    const entry: MemoryStoreEntry = {
      totalHits: 1,
      resetTime,
    };
    this.store.set(key, entry);
    
    return {
      totalHits: 1,
      resetTime,
    };
  }

  /**
   * Decrements the hit count for a key
   */
  decrement(key: string): void {
    const existing = this.store.get(key);
    if (existing && existing.totalHits > 0) {
      existing.totalHits -= 1;
    }
  }

  /**
   * Resets the hit count for a key
   */
  resetKey(key: string): void {
    this.store.delete(key);
  }

  /**
   * Gets the current hit count for a key
   */
  get(key: string): RateLimitInfo | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    
    // Check if expired
    if (entry.resetTime.getTime() <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    
    return {
      totalHits: entry.totalHits,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Cleans up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime.getTime() <= now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Stops the cleanup interval
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }

  /**
   * Returns the number of entries in the store
   */
  get size(): number {
    return this.store.size;
  }
}


/**
 * Redis-backed rate limit store with in-memory fallback
 * Implements the express-rate-limit Store interface
 * Requirements: 7.2, 7.5
 */
export class RedisRateLimitStore implements Store {
  private windowMs: number;
  private keyPrefix: string;
  private memoryStore: InMemoryStore;
  private usingFallback: boolean = false;

  /**
   * Creates a new Redis rate limit store
   * @param windowMs - The time window in milliseconds
   * @param keyPrefix - Key prefix for Redis keys (default: 'rl:')
   */
  constructor(windowMs: number = 60000, keyPrefix: string = 'rl:') {
    this.windowMs = windowMs;
    this.keyPrefix = keyPrefix;
    this.memoryStore = new InMemoryStore();
  }

  /**
   * Initializes the store (required by express-rate-limit)
   */
  init(options: Options): void {
    this.windowMs = options.windowMs;
    logger.debug('RedisRateLimitStore initialized', { windowMs: this.windowMs });
  }

  /**
   * Gets the full Redis key for a client key
   */
  private getRedisKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Checks if Redis is available
   */
  isRedisAvailable(): boolean {
    return redisClient.isConnected();
  }

  /**
   * Checks if currently using fallback mode
   */
  isUsingFallback(): boolean {
    return this.usingFallback;
  }

  /**
   * Increments the hit count for a client
   * Falls back to in-memory if Redis is unavailable
   * Requirement 7.5: WHEN Redis is unavailable, THE API_Server SHALL fall back to in-memory rate limiting
   */
  async increment(key: string): Promise<IncrementResponse> {
    // Check if Redis is available
    if (!redisClient.isConnected()) {
      if (!this.usingFallback) {
        logger.warn('Redis unavailable, falling back to in-memory rate limiting');
        this.usingFallback = true;
      }
      return this.incrementMemory(key);
    }

    // If we were using fallback but Redis is now available, switch back
    if (this.usingFallback) {
      logger.info('Redis available again, switching from in-memory fallback');
      this.usingFallback = false;
    }

    try {
      return await this.incrementRedis(key);
    } catch (error) {
      logger.warn('Redis increment failed, falling back to in-memory', { error });
      this.usingFallback = true;
      return this.incrementMemory(key);
    }
  }

  /**
   * Increments using Redis
   */
  private async incrementRedis(key: string): Promise<IncrementResponse> {
    const redisKey = this.getRedisKey(key);
    const client = redisClient.getClient();

    // Use MULTI to atomically increment and set expiry
    const pipeline = client.multi();
    pipeline.incr(redisKey);
    pipeline.pttl(redisKey);
    
    const results = await pipeline.exec();
    
    if (!results || results.length < 2) {
      throw new Error('Redis pipeline returned unexpected results');
    }

    const [incrResult, pttlResult] = results;
    const totalHits = (incrResult[1] as number) || 1;
    let ttlMs = (pttlResult[1] as number) || -1;

    // If key is new (no TTL), set the expiry
    if (ttlMs === -1 || ttlMs === -2) {
      await client.pexpire(redisKey, this.windowMs);
      ttlMs = this.windowMs;
    }

    const resetTime = new Date(Date.now() + ttlMs);

    return {
      totalHits,
      resetTime,
    };
  }

  /**
   * Increments using in-memory store
   */
  private incrementMemory(key: string): IncrementResponse {
    const result = this.memoryStore.increment(key, this.windowMs);
    return {
      totalHits: result.totalHits,
      resetTime: result.resetTime,
    };
  }

  /**
   * Decrements the hit count for a client
   */
  async decrement(key: string): Promise<void> {
    if (!redisClient.isConnected() || this.usingFallback) {
      this.memoryStore.decrement(key);
      return;
    }

    try {
      const redisKey = this.getRedisKey(key);
      const client = redisClient.getClient();
      await client.decr(redisKey);
    } catch (error) {
      logger.warn('Redis decrement failed, using in-memory fallback', { error });
      this.memoryStore.decrement(key);
    }
  }

  /**
   * Resets the hit count for a client
   */
  async resetKey(key: string): Promise<void> {
    // Always reset in memory store
    this.memoryStore.resetKey(key);

    if (!redisClient.isConnected() || this.usingFallback) {
      return;
    }

    try {
      const redisKey = this.getRedisKey(key);
      const client = redisClient.getClient();
      await client.del(redisKey);
    } catch (error) {
      logger.warn('Redis resetKey failed', { error });
    }
  }

  /**
   * Gets the current rate limit info for a client (optional method)
   */
  async get(key: string): Promise<RateLimitInfo | undefined> {
    if (!redisClient.isConnected() || this.usingFallback) {
      return this.memoryStore.get(key);
    }

    try {
      const redisKey = this.getRedisKey(key);
      const client = redisClient.getClient();
      
      const pipeline = client.multi();
      pipeline.get(redisKey);
      pipeline.pttl(redisKey);
      
      const results = await pipeline.exec();
      
      if (!results || results.length < 2) {
        return undefined;
      }

      const [getResult, pttlResult] = results;
      const hits = getResult[1] as string | null;
      const ttlMs = pttlResult[1] as number;

      if (!hits || ttlMs <= 0) {
        return undefined;
      }

      return {
        totalHits: parseInt(hits, 10),
        resetTime: new Date(Date.now() + ttlMs),
      };
    } catch (error) {
      logger.warn('Redis get failed, using in-memory fallback', { error });
      return this.memoryStore.get(key);
    }
  }

  /**
   * Shuts down the store and cleans up resources
   */
  shutdown(): void {
    this.memoryStore.shutdown();
    logger.debug('RedisRateLimitStore shutdown');
  }
}

/**
 * Creates a Redis rate limit store instance
 * @param windowMs - The time window in milliseconds
 * @param keyPrefix - Key prefix for Redis keys
 */
export function createRedisRateLimitStore(
  windowMs: number = 60000,
  keyPrefix: string = 'rl:'
): RedisRateLimitStore {
  return new RedisRateLimitStore(windowMs, keyPrefix);
}

// Export the InMemoryStore for testing
export { InMemoryStore };
