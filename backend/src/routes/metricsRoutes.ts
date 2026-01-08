/**
 * Metrics routes for Prometheus scraping
 * 
 * Routes:
 * - GET /metrics - Returns metrics in Prometheus exposition format
 * 
 * Requirements: 10.1, 10.3, 10.4, 10.5
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getMetricsService } from '../monitoring';

const router = Router();

/**
 * Checks if the request is from an internal network
 * Internal networks: localhost, private IP ranges (10.x, 172.16-31.x, 192.168.x)
 */
function isInternalNetwork(ip: string | undefined): boolean {
  if (!ip) return false;
  
  // Normalize IPv6 localhost to IPv4
  const normalizedIp = ip === '::1' || ip === '::ffff:127.0.0.1' ? '127.0.0.1' : ip;
  
  // Remove IPv6 prefix if present
  const cleanIp = normalizedIp.replace(/^::ffff:/, '');
  
  // Check localhost
  if (cleanIp === '127.0.0.1' || cleanIp === 'localhost') {
    return true;
  }
  
  // Check private IP ranges
  const parts = cleanIp.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return false;
  }
  
  // 10.0.0.0 - 10.255.255.255
  if (parts[0] === 10) {
    return true;
  }
  
  // 172.16.0.0 - 172.31.255.255
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }
  
  // 192.168.0.0 - 192.168.255.255
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }
  
  return false;
}

/**
 * Authentication/network restriction middleware for metrics endpoint
 * Allows access if:
 * 1. Request is from internal network, OR
 * 2. Valid METRICS_AUTH_TOKEN is provided in Authorization header
 * 
 * Requirements: 10.5
 */
export function metricsAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Get client IP from various headers (for proxied requests) or socket
  const clientIp = 
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress;
  
  // Allow internal network access
  if (isInternalNetwork(clientIp)) {
    next();
    return;
  }
  
  // Check for auth token
  const authHeader = req.headers.authorization;
  const metricsAuthToken = process.env.METRICS_AUTH_TOKEN;
  
  // If no token is configured, deny external access
  if (!metricsAuthToken) {
    res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Metrics endpoint is not accessible from external networks',
    });
    return;
  }
  
  // Validate Bearer token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Authentication required for metrics endpoint',
    });
    return;
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  if (token !== metricsAuthToken) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Invalid authentication token',
    });
    return;
  }
  
  next();
}

/**
 * GET /metrics
 * 
 * Returns metrics in Prometheus exposition format.
 * Protected by network restriction and/or authentication.
 * 
 * Response: Prometheus text format with metrics
 * 
 * Requirements: 10.1, 10.3, 10.4
 */
router.get('/metrics', metricsAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const metricsService = getMetricsService();
    const metrics = await metricsService.getMetrics();
    
    res.set('Content-Type', metricsService.getContentType());
    res.send(metrics);
  } catch (error) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to collect metrics',
    });
  }
});

export { router as metricsRoutes };

// Export helper for testing
export { isInternalNetwork };
