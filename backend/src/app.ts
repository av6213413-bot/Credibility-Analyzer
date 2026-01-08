/**
 * Express application setup
 * Configures Express with all middleware and mounts routes
 * Initializes MongoDB and Redis connections on startup
 * Requirements: 1.1, 4.1, 7.1, 7.2, 7.3, 10.1
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Middleware imports
import {
  securityHeaders,
  corsMiddleware,
  rateLimiter,
  createRateLimiterWithRedis,
  errorHandler,
} from './middleware';

// Route imports
import { analysisRoutes } from './routes/analysisRoutes';
import { healthRoutes } from './routes/healthRoutes';
import { jobRoutes } from './routes/jobRoutes';
import { metricsRoutes } from './routes/metricsRoutes';

// Monitoring imports
import {
  createMetricsMiddleware,
  getMetricsService,
  initSentry,
  createSentryRequestHandler,
  createSentryErrorHandler,
} from './monitoring';

// Database and cache imports
import { mongoClient } from './database/mongoClient';
import { redisClient } from './cache/redisClient';
import { logger } from './utils/logger';

// Check if running in test environment
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

// Extend Request type to include id
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Initializes database and cache connections
 * Handles connection failures gracefully - logs warnings but continues startup
 * Requirements: 4.1, 7.1
 */
export async function initializeConnections(): Promise<void> {
  // Initialize MongoDB connection
  try {
    await mongoClient.connect();
    if (mongoClient.isConnected()) {
      logger.info('MongoDB connection established');
    }
  } catch (error) {
    logger.warn('MongoDB connection failed - continuing without database', { error });
    // Continue without MongoDB - graceful degradation
  }

  // Initialize Redis connection
  try {
    await redisClient.connect();
    if (redisClient.isConnected()) {
      logger.info('Redis connection established');
    }
  } catch (error) {
    logger.warn('Redis connection failed - continuing with in-memory fallback', { error });
    // Continue without Redis - graceful degradation with in-memory fallback
  }
}

/**
 * Gracefully shuts down database and cache connections
 */
export async function shutdownConnections(): Promise<void> {
  try {
    if (mongoClient.isConnected()) {
      await mongoClient.disconnect();
      logger.info('MongoDB connection closed');
    }
  } catch (error) {
    logger.error('Error closing MongoDB connection', { error });
  }

  try {
    if (redisClient.isConnected()) {
      await redisClient.disconnect();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing Redis connection', { error });
  }
}

/**
 * Creates and configures the Express application
 * @returns Configured Express application
 */
export function createApp(): Application {
  const app = express();

  // Initialize Sentry - must be done before adding middleware
  // Requirements: 7.1
  initSentry(app);

  // Sentry request handler - must be first middleware
  // Requirements: 7.1
  app.use(createSentryRequestHandler());

  // Request ID middleware - adds unique ID to each request for tracing
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.id = uuidv4();
    next();
  });

  // Metrics middleware - records HTTP request metrics (must be early in chain)
  // Requirements: 1.1, 10.1
  const metricsService = getMetricsService();
  app.use(createMetricsMiddleware(metricsService));

  // Security middleware - sets security headers (X-Content-Type-Options, X-Frame-Options, etc.)
  // Requirements: 7.3
  app.use(securityHeaders);

  // CORS middleware - enables cross-origin requests from configured origins
  // Requirements: 7.1
  app.use(corsMiddleware);

  // Rate limiting middleware
  // In test environment, use simple in-memory rate limiter to avoid Redis store validation issues
  // In production, use Redis-backed store with in-memory fallback
  // Requirements: 7.2, 7.5
  if (isTestEnvironment) {
    app.use(rateLimiter);
  } else {
    app.use(createRateLimiterWithRedis());
  }

  // Body parsing middleware - parses JSON request bodies
  app.use(express.json({ limit: '1mb' }));

  // Mount health routes (no /api prefix for standard health checks)
  // Requirements: 8.1, 8.2
  app.use('/', healthRoutes);

  // Mount metrics routes (no /api prefix for Prometheus scraping)
  // Requirements: 10.1, 10.3, 10.4, 10.5
  app.use('/', metricsRoutes);

  // Mount analysis routes under /api/analyze
  // Requirements: 1.1, 2.1
  app.use('/api/analyze', analysisRoutes);

  // Mount job routes under /api/jobs
  // Requirements: 10.6
  app.use('/api/jobs', jobRoutes);

  // 404 handler for unmatched routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
    });
  });

  // Sentry error handler - must be before custom error handler
  // Requirements: 7.1
  app.use(createSentryErrorHandler());

  // Centralized error handler - must be last middleware
  // Requirements: 5.1, 5.2, 5.3, 5.4
  app.use(errorHandler);

  return app;
}

// Export metrics service for use in other modules
export { getMetricsService } from './monitoring';

// Export default app instance
export const app = createApp();
