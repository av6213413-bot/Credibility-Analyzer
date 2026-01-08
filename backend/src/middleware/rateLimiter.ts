/**
 * Rate limiting middleware configuration
 * Prevents abuse by limiting request frequency per IP
 * Supports Redis-backed store with in-memory fallback
 * Requirements: 7.2, 7.5
 */

import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { config } from '../config';
import { createRedisRateLimitStore, RedisRateLimitStore } from '../cache/rateLimitStore';
import { logger } from '../utils/logger';

// Store reference for cleanup
let redisStore: RedisRateLimitStore | null = null;

/**
 * Default rate limiter using configuration values
 * Limits requests per IP within the configured time window
 */
export const rateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitMax,
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later',
    suggestedAction: `Please wait before making more requests`,
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Creates a rate limiter with custom configuration
 * Useful for different endpoints with varying limits
 */
export function createRateLimiter(options: Partial<Options>): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs ?? config.rateLimitWindow,
    max: options.max ?? config.rateLimitMax,
    message: options.message ?? {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      suggestedAction: 'Please wait before making more requests',
    },
    standardHeaders: true,
    legacyHeaders: false,
    ...options,
  });
}

/**
 * Creates a rate limiter with Redis-backed store
 * Falls back to in-memory store when Redis is unavailable
 * Requirements: 7.2, 7.5
 */
export function createRateLimiterWithRedis(options?: Partial<Options>): RateLimitRequestHandler {
  const windowMs = options?.windowMs ?? config.rateLimitWindow;
  
  // Create Redis-backed store with fallback capability
  redisStore = createRedisRateLimitStore(windowMs, 'rl:');
  
  logger.info('Rate limiter initialized with Redis store (with in-memory fallback)', {
    windowMs,
    max: options?.max ?? config.rateLimitMax,
  });

  return rateLimit({
    windowMs,
    max: options?.max ?? config.rateLimitMax,
    message: options?.message ?? {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      suggestedAction: 'Please wait before making more requests',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    store: redisStore,
    ...options,
  });
}

/**
 * Gets the current Redis rate limit store instance
 * Useful for checking fallback status
 */
export function getRedisRateLimitStore(): RedisRateLimitStore | null {
  return redisStore;
}

/**
 * Shuts down the Redis rate limit store
 * Should be called during application shutdown
 */
export function shutdownRateLimitStore(): void {
  if (redisStore) {
    redisStore.shutdown();
    redisStore = null;
    logger.info('Rate limit store shutdown');
  }
}

/**
 * Stricter rate limiter for analysis endpoints
 * More restrictive to prevent abuse of resource-intensive operations
 */
export const analysisRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: config.rateLimitWindow,
  max: Math.floor(config.rateLimitMax / 2), // Half the normal limit
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many analysis requests, please try again later',
    suggestedAction: 'Analysis requests are limited to prevent abuse',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
