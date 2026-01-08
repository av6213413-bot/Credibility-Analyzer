/**
 * Daily Active User (DAU) Tracker
 * Tracks unique users per day using Redis sets
 * Requirements: 5.1
 */

import { redisClient } from '../cache/redisClient';
import { logger } from '../utils/logger';
import { Gauge } from 'prom-client';
import { getMetricsService } from './metricsService';

// Key prefix for DAU tracking
const DAU_KEY_PREFIX = 'dau:';

// Gauge for exposing DAU count as a metric
let dauGauge: Gauge | null = null;

/**
 * Gets the current UTC date string in YYYY-MM-DD format
 * Used as part of the Redis key for daily tracking
 */
export function getCurrentDateKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generates the Redis key for a specific date
 * @param dateKey - Date string in YYYY-MM-DD format
 * @returns Full Redis key for DAU tracking
 */
export function getDauRedisKey(dateKey: string): string {
  return `${DAU_KEY_PREFIX}${dateKey}`;
}

/**
 * Calculates seconds until midnight UTC
 * Used to set TTL on Redis keys for automatic cleanup
 * @returns Number of seconds until midnight UTC
 */
export function getSecondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}


/**
 * Extracts a unique identifier from request
 * Uses IP address or session ID for tracking
 * Note: IP addresses are hashed to avoid storing PII
 * @param identifier - IP address or session ID
 * @returns Hashed identifier for privacy
 */
export function hashIdentifier(identifier: string): string {
  // Simple hash function for privacy - not cryptographically secure
  // but sufficient for DAU tracking purposes
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `user_${Math.abs(hash).toString(16)}`;
}

/**
 * Tracks a unique user for the current day
 * Uses Redis SADD to add to a set (automatically handles uniqueness)
 * Requirements: 5.1
 * 
 * @param identifier - Unique identifier (IP or session ID)
 * @returns true if this is a new user for today, false if already tracked
 */
export async function trackDailyActiveUser(identifier: string): Promise<boolean> {
  if (!redisClient.isConnected()) {
    logger.debug('Redis not connected, skipping DAU tracking');
    return false;
  }

  try {
    const dateKey = getCurrentDateKey();
    const redisKey = getDauRedisKey(dateKey);
    const hashedId = hashIdentifier(identifier);
    
    const client = redisClient.getClient();
    
    // SADD returns 1 if the element was added, 0 if it already existed
    const result = await client.sadd(redisKey, hashedId);
    
    // Set expiry to clean up old keys (24 hours + buffer)
    const ttl = getSecondsUntilMidnightUTC() + 86400; // Keep for 1 extra day
    await client.expire(redisKey, ttl);
    
    const isNewUser = result === 1;
    
    if (isNewUser) {
      logger.debug('New daily active user tracked', { dateKey });
    }
    
    return isNewUser;
  } catch (error) {
    logger.warn('Failed to track daily active user', { error });
    return false;
  }
}

/**
 * Gets the count of daily active users for a specific date
 * Requirements: 5.1
 * 
 * @param dateKey - Optional date string (defaults to today)
 * @returns Number of unique users for the specified day
 */
export async function getDailyActiveUserCount(dateKey?: string): Promise<number> {
  if (!redisClient.isConnected()) {
    logger.debug('Redis not connected, returning 0 for DAU count');
    return 0;
  }

  try {
    const key = getDauRedisKey(dateKey || getCurrentDateKey());
    const client = redisClient.getClient();
    
    // SCARD returns the number of elements in the set
    const count = await client.scard(key);
    
    return count;
  } catch (error) {
    logger.warn('Failed to get daily active user count', { error });
    return 0;
  }
}

/**
 * Initializes the DAU gauge metric
 * Should be called during application startup
 */
export function initDauMetric(): void {
  try {
    // Ensure metrics service is initialized
    getMetricsService();
    
    // Create a gauge for DAU if not already created
    if (!dauGauge) {
      dauGauge = new Gauge({
        name: 'daily_active_users',
        help: 'Number of unique daily active users',
        async collect() {
          const count = await getDailyActiveUserCount();
          this.set(count);
        },
      });
      
      logger.info('DAU metric initialized');
    }
  } catch (error) {
    logger.warn('Failed to initialize DAU metric', { error });
  }
}

/**
 * Creates Express middleware for tracking DAU
 * Extracts IP from request and tracks the user
 * Requirements: 5.1
 */
export function createDauMiddleware() {
  return async (req: { ip?: string; headers: Record<string, string | string[] | undefined> }, _res: unknown, next: () => void) => {
    try {
      // Get IP from X-Forwarded-For header (for proxied requests) or req.ip
      const forwardedFor = req.headers['x-forwarded-for'];
      const ip = typeof forwardedFor === 'string' 
        ? forwardedFor.split(',')[0].trim()
        : req.ip || 'unknown';
      
      // Track asynchronously without blocking the request
      trackDailyActiveUser(ip).catch(err => {
        logger.debug('DAU tracking failed', { error: err });
      });
    } catch (error) {
      logger.debug('Error in DAU middleware', { error });
    }
    
    next();
  };
}

/**
 * Resets DAU tracking for a specific date (for testing)
 * @param dateKey - Date string in YYYY-MM-DD format
 */
export async function resetDauTracking(dateKey?: string): Promise<void> {
  if (!redisClient.isConnected()) {
    return;
  }

  try {
    const key = getDauRedisKey(dateKey || getCurrentDateKey());
    const client = redisClient.getClient();
    await client.del(key);
    logger.debug('DAU tracking reset', { dateKey });
  } catch (error) {
    logger.warn('Failed to reset DAU tracking', { error });
  }
}
