import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metricsService';

/**
 * Normalizes URL paths to prevent high cardinality in metrics.
 * Replaces dynamic segments (UUIDs, numeric IDs) with placeholders.
 */
export const normalizePath = (path: string): string => {
  return path
    // Replace UUIDs with :id
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '/:id'
    )
    // Replace numeric IDs with :id
    .replace(/\/\d+/g, '/:id');
};

/**
 * Creates Express middleware that records HTTP request metrics.
 * Records request count and duration for each request.
 */
export const createMetricsMiddleware = (metrics: MetricsService) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      const path = normalizePath(req.path);
      const method = req.method;
      const status = res.statusCode.toString();

      // Increment request counter
      metrics.httpRequestsTotal.inc({ method, path, status });

      // Record request duration
      metrics.httpRequestDuration.observe({ method, path, status }, duration);
    });

    next();
  };
};
