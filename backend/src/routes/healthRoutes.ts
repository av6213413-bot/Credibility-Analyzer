import { Router } from 'express';
import { handleHealth, handleReady } from '../controllers/healthController';

/**
 * Health check routes for monitoring and orchestration
 * 
 * Routes:
 * - GET /health - Liveness check (is the server running?)
 * - GET /ready - Readiness check (can the server handle requests?)
 * 
 * Requirements: 8.1, 8.2
 */
const router = Router();

/**
 * GET /health
 * 
 * Liveness probe endpoint.
 * Returns 200 when the server is running.
 * 
 * Response: { status: 'ok', timestamp: string, service: string }
 * 
 * Requirements: 8.1
 */
router.get('/health', handleHealth);

/**
 * GET /ready
 * 
 * Readiness probe endpoint.
 * Returns 200 only when the ML service is reachable.
 * Returns 503 with details when dependencies are unavailable.
 * 
 * Response: { status: 'ok'|'error', timestamp: string, service: string, dependencies: {...} }
 * 
 * Requirements: 8.2
 */
router.get('/ready', handleReady);

export { router as healthRoutes };
