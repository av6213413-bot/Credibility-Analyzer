import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { isMLServiceAvailable } from '../services/mlClient';
import { mongoClient } from '../database/mongoClient';
import { redisClient } from '../cache/redisClient';
import { logger } from '../utils/logger';

// Track server start time for uptime calculation
const serverStartTime = Date.now();

// Package version (can be overridden for testing)
let packageVersion = '1.0.0';
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require('../../package.json');
  packageVersion = pkg.version || '1.0.0';
} catch {
  // Use default version if package.json cannot be loaded
}

/**
 * Dependency status interface
 * Requirements: 10.4, 10.6
 */
export interface DependencyStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

/**
 * Health check response interface for liveness probe
 * Requirements: 10.5
 */
interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  service: string;
}

/**
 * Enhanced readiness check response interface
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.6
 */
export interface ReadinessResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  dependencies: {
    mongodb: DependencyStatus;
    redis: DependencyStatus;
    mlService: DependencyStatus;
  };
}

/**
 * Gets the current server uptime in seconds
 */
export function getUptime(): number {
  return Math.floor((Date.now() - serverStartTime) / 1000);
}

/**
 * Gets the package version
 */
export function getVersion(): string {
  return packageVersion;
}

/**
 * Sets the package version (for testing)
 */
export function setVersion(version: string): void {
  packageVersion = version;
}

/**
 * Checks MongoDB connectivity with latency measurement
 * Requirements: 10.1
 */
export async function checkMongoDBHealth(): Promise<DependencyStatus> {
  const startTime = Date.now();
  
  try {
    if (!mongoClient.isConnected()) {
      return {
        status: 'down',
        error: 'MongoDB not connected',
      };
    }
    
    // Ping the database to verify connectivity
    const db = mongoClient.getDb();
    await db.command({ ping: 1 });
    
    return {
      status: 'up',
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      status: 'down',
      latencyMs: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

/**
 * Checks Redis connectivity with latency measurement
 * Requirements: 10.2
 */
export async function checkRedisHealth(): Promise<DependencyStatus> {
  const startTime = Date.now();
  
  try {
    if (!redisClient.isConnected()) {
      return {
        status: 'down',
        error: 'Redis not connected',
      };
    }
    
    // Ping Redis to verify connectivity
    const isHealthy = await redisClient.ping();
    
    if (!isHealthy) {
      return {
        status: 'down',
        latencyMs: Date.now() - startTime,
        error: 'Redis ping failed',
      };
    }
    
    return {
      status: 'up',
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      status: 'down',
      latencyMs: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

/**
 * Checks ML service availability with latency measurement
 * Requirements: 10.3
 */
export async function checkMLServiceHealth(): Promise<DependencyStatus> {
  const startTime = Date.now();
  
  try {
    const isAvailable = await isMLServiceAvailable();
    
    if (!isAvailable) {
      return {
        status: 'down',
        latencyMs: Date.now() - startTime,
        error: 'ML service is not reachable',
      };
    }
    
    return {
      status: 'up',
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      status: 'down',
      latencyMs: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

/**
 * Determines overall health status based on dependency statuses
 * Requirements: 10.4
 */
export function determineOverallStatus(dependencies: {
  mongodb: DependencyStatus;
  redis: DependencyStatus;
  mlService: DependencyStatus;
}): 'healthy' | 'degraded' | 'unhealthy' {
  const { mongodb, redis, mlService } = dependencies;
  
  // If ML service is down, system is unhealthy (critical dependency)
  if (mlService.status === 'down') {
    return 'unhealthy';
  }
  
  // If MongoDB is down, system is unhealthy (critical for persistence)
  if (mongodb.status === 'down') {
    return 'unhealthy';
  }
  
  // If Redis is down, system is degraded (can fall back to in-memory)
  if (redis.status === 'down') {
    return 'degraded';
  }
  
  return 'healthy';
}

/**
 * Controller for liveness health check
 * 
 * Returns 200 when the server is running.
 * Used by load balancers and orchestrators to verify the service is alive.
 * This is a simple liveness check with no dependency checks.
 * 
 * @route GET /health
 * @param _req - Express request (unused)
 * @param res - Express response
 * 
 * Requirements: 10.5
 */
export const handleHealth = (_req: Request, res: Response): void => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'credibility-analyzer-api',
  };

  res.status(200).json(response);
};

/**
 * Controller for readiness check
 * 
 * Checks MongoDB, Redis, and ML service connectivity.
 * Returns 200 when all critical dependencies are healthy.
 * Returns 503 with details when any critical dependency is unhealthy.
 * Used by load balancers to determine if the service can handle requests.
 * 
 * @route GET /ready
 * @param _req - Express request (unused)
 * @param res - Express response
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.6
 */
export const handleReady = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    // Check all dependencies in parallel
    const [mongodbStatus, redisStatus, mlServiceStatus] = await Promise.all([
      checkMongoDBHealth(),
      checkRedisHealth(),
      checkMLServiceHealth(),
    ]);

    const dependencies = {
      mongodb: mongodbStatus,
      redis: redisStatus,
      mlService: mlServiceStatus,
    };

    const overallStatus = determineOverallStatus(dependencies);

    const response: ReadinessResponse = {
      status: overallStatus,
      version: getVersion(),
      uptime: getUptime(),
      timestamp: new Date().toISOString(),
      dependencies,
    };

    if (overallStatus === 'unhealthy') {
      logger.warn('Readiness check failed', { dependencies });
      res.status(503).json(response);
      return;
    }

    if (overallStatus === 'degraded') {
      logger.warn('Readiness check degraded', { dependencies });
    } else {
      logger.debug('Readiness check passed');
    }

    res.status(200).json(response);
  }
);
