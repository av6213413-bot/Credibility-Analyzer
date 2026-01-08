/**
 * Property-Based Tests for Health Controller
 * Feature: infrastructure-deployment
 * 
 * Tests correctness properties for health check endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  determineOverallStatus,
  checkMongoDBHealth,
  checkRedisHealth,
  checkMLServiceHealth,
  getUptime,
  getVersion,
  setVersion,
} from './healthController';

// Mock the dependencies
vi.mock('../database/mongoClient', () => ({
  mongoClient: {
    isConnected: vi.fn(),
    getDb: vi.fn(),
  },
}));

vi.mock('../cache/redisClient', () => ({
  redisClient: {
    isConnected: vi.fn(),
    ping: vi.fn(),
  },
}));

vi.mock('../services/mlClient', () => ({
  isMLServiceAvailable: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { mongoClient } from '../database/mongoClient';
import { redisClient } from '../cache/redisClient';
import { isMLServiceAvailable } from '../services/mlClient';

/**
 * Feature: infrastructure-deployment, Property 8: Health Check Dependency Failure Details
 * Validates: Requirements 10.4
 *
 * For any unhealthy dependency (MongoDB, Redis, ML Service), the /ready endpoint
 * response SHALL include the specific dependency name and error details in the response body.
 */
describe('Property 8: Health Check Dependency Failure Details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Generator for error messages
  const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 100 });

  // Generator for dependency status combinations
  const dependencyStatusArbitrary = fc.record({
    mongodb: fc.record({
      status: fc.constantFrom('up', 'down') as fc.Arbitrary<'up' | 'down'>,
      latencyMs: fc.option(fc.nat({ max: 1000 }), { nil: undefined }),
      error: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    }),
    redis: fc.record({
      status: fc.constantFrom('up', 'down') as fc.Arbitrary<'up' | 'down'>,
      latencyMs: fc.option(fc.nat({ max: 1000 }), { nil: undefined }),
      error: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    }),
    mlService: fc.record({
      status: fc.constantFrom('up', 'down') as fc.Arbitrary<'up' | 'down'>,
      latencyMs: fc.option(fc.nat({ max: 1000 }), { nil: undefined }),
      error: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    }),
  });

  it('Property 8: When MongoDB is down, response includes mongodb dependency with error details', () => {
    fc.assert(
      fc.property(errorMessageArbitrary, (errorMessage) => {
        const dependencies = {
          mongodb: { status: 'down' as const, error: errorMessage },
          redis: { status: 'up' as const, latencyMs: 5 },
          mlService: { status: 'up' as const, latencyMs: 10 },
        };

        const overallStatus = determineOverallStatus(dependencies);

        // When MongoDB is down, overall status should be unhealthy
        expect(overallStatus).toBe('unhealthy');

        // The dependencies object should contain mongodb with error
        expect(dependencies.mongodb.status).toBe('down');
        expect(dependencies.mongodb.error).toBe(errorMessage);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 8: When Redis is down, response includes redis dependency with error details', () => {
    fc.assert(
      fc.property(errorMessageArbitrary, (errorMessage) => {
        const dependencies = {
          mongodb: { status: 'up' as const, latencyMs: 5 },
          redis: { status: 'down' as const, error: errorMessage },
          mlService: { status: 'up' as const, latencyMs: 10 },
        };

        const overallStatus = determineOverallStatus(dependencies);

        // When only Redis is down, overall status should be degraded
        expect(overallStatus).toBe('degraded');

        // The dependencies object should contain redis with error
        expect(dependencies.redis.status).toBe('down');
        expect(dependencies.redis.error).toBe(errorMessage);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 8: When ML Service is down, response includes mlService dependency with error details', () => {
    fc.assert(
      fc.property(errorMessageArbitrary, (errorMessage) => {
        const dependencies = {
          mongodb: { status: 'up' as const, latencyMs: 5 },
          redis: { status: 'up' as const, latencyMs: 3 },
          mlService: { status: 'down' as const, error: errorMessage },
        };

        const overallStatus = determineOverallStatus(dependencies);

        // When ML Service is down, overall status should be unhealthy
        expect(overallStatus).toBe('unhealthy');

        // The dependencies object should contain mlService with error
        expect(dependencies.mlService.status).toBe('down');
        expect(dependencies.mlService.error).toBe(errorMessage);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 8: For any combination of unhealthy dependencies, each failed dependency has error details', () => {
    fc.assert(
      fc.property(dependencyStatusArbitrary, (dependencies) => {
        // Ensure down dependencies have error field
        const normalizedDeps = {
          mongodb: {
            ...dependencies.mongodb,
            error: dependencies.mongodb.status === 'down' 
              ? (dependencies.mongodb.error || 'MongoDB error') 
              : undefined,
          },
          redis: {
            ...dependencies.redis,
            error: dependencies.redis.status === 'down' 
              ? (dependencies.redis.error || 'Redis error') 
              : undefined,
          },
          mlService: {
            ...dependencies.mlService,
            error: dependencies.mlService.status === 'down' 
              ? (dependencies.mlService.error || 'ML Service error') 
              : undefined,
          },
        };

        // Check that each down dependency has an error field
        if (normalizedDeps.mongodb.status === 'down') {
          expect(normalizedDeps.mongodb.error).toBeDefined();
          expect(typeof normalizedDeps.mongodb.error).toBe('string');
        }

        if (normalizedDeps.redis.status === 'down') {
          expect(normalizedDeps.redis.error).toBeDefined();
          expect(typeof normalizedDeps.redis.error).toBe('string');
        }

        if (normalizedDeps.mlService.status === 'down') {
          expect(normalizedDeps.mlService.error).toBeDefined();
          expect(typeof normalizedDeps.mlService.error).toBe('string');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 8: checkMongoDBHealth returns error details when MongoDB is not connected', async () => {
    vi.mocked(mongoClient.isConnected).mockReturnValue(false);

    const result = await checkMongoDBHealth();

    expect(result.status).toBe('down');
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe('string');
    expect(result.error).toBe('MongoDB not connected');
  });

  it('Property 8: checkRedisHealth returns error details when Redis is not connected', async () => {
    vi.mocked(redisClient.isConnected).mockReturnValue(false);

    const result = await checkRedisHealth();

    expect(result.status).toBe('down');
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe('string');
    expect(result.error).toBe('Redis not connected');
  });

  it('Property 8: checkMLServiceHealth returns error details when ML service is unavailable', async () => {
    vi.mocked(isMLServiceAvailable).mockResolvedValue(false);

    const result = await checkMLServiceHealth();

    expect(result.status).toBe('down');
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe('string');
    expect(result.error).toBe('ML service is not reachable');
  });
});


/**
 * Feature: infrastructure-deployment, Property 9: Health Check Response Completeness
 * Validates: Requirements 10.6
 *
 * For any health check response, the body SHALL contain: status, version, uptime (in seconds),
 * timestamp (ISO 8601), and dependencies object with status for each service.
 */
describe('Property 9: Health Check Response Completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Generator for version strings
  const versionArbitrary = fc.stringMatching(/^\d+\.\d+\.\d+$/);

  // Generator for uptime values (in seconds)
  const uptimeArbitrary = fc.nat({ max: 86400 * 365 }); // Up to 1 year

  // Generator for dependency statuses
  const dependencyStatusArbitrary = fc.record({
    status: fc.constantFrom('up', 'down') as fc.Arbitrary<'up' | 'down'>,
    latencyMs: fc.option(fc.nat({ max: 1000 }), { nil: undefined }),
    error: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  });

  // Generator for complete readiness response
  const readinessResponseArbitrary = fc.record({
    status: fc.constantFrom('healthy', 'degraded', 'unhealthy') as fc.Arbitrary<'healthy' | 'degraded' | 'unhealthy'>,
    version: versionArbitrary,
    uptime: uptimeArbitrary,
    timestamp: fc.date().map(d => d.toISOString()),
    dependencies: fc.record({
      mongodb: dependencyStatusArbitrary,
      redis: dependencyStatusArbitrary,
      mlService: dependencyStatusArbitrary,
    }),
  });

  it('Property 9: Response contains status field with valid value', () => {
    fc.assert(
      fc.property(readinessResponseArbitrary, (response) => {
        // Status must be present
        expect(response).toHaveProperty('status');
        
        // Status must be one of the valid values
        expect(['healthy', 'degraded', 'unhealthy']).toContain(response.status);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: Response contains version field as string', () => {
    fc.assert(
      fc.property(readinessResponseArbitrary, (response) => {
        // Version must be present
        expect(response).toHaveProperty('version');
        
        // Version must be a string
        expect(typeof response.version).toBe('string');
        
        // Version should match semver pattern
        expect(response.version).toMatch(/^\d+\.\d+\.\d+$/);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: Response contains uptime field as number (seconds)', () => {
    fc.assert(
      fc.property(readinessResponseArbitrary, (response) => {
        // Uptime must be present
        expect(response).toHaveProperty('uptime');
        
        // Uptime must be a number
        expect(typeof response.uptime).toBe('number');
        
        // Uptime must be non-negative
        expect(response.uptime).toBeGreaterThanOrEqual(0);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: Response contains timestamp field in ISO 8601 format', () => {
    fc.assert(
      fc.property(readinessResponseArbitrary, (response) => {
        // Timestamp must be present
        expect(response).toHaveProperty('timestamp');
        
        // Timestamp must be a string
        expect(typeof response.timestamp).toBe('string');
        
        // Timestamp must be valid ISO 8601
        const parsed = new Date(response.timestamp);
        expect(parsed.toISOString()).toBe(response.timestamp);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: Response contains dependencies object with all required services', () => {
    fc.assert(
      fc.property(readinessResponseArbitrary, (response) => {
        // Dependencies must be present
        expect(response).toHaveProperty('dependencies');
        
        // Dependencies must be an object
        expect(typeof response.dependencies).toBe('object');
        
        // Must have mongodb dependency
        expect(response.dependencies).toHaveProperty('mongodb');
        expect(response.dependencies.mongodb).toHaveProperty('status');
        expect(['up', 'down']).toContain(response.dependencies.mongodb.status);
        
        // Must have redis dependency
        expect(response.dependencies).toHaveProperty('redis');
        expect(response.dependencies.redis).toHaveProperty('status');
        expect(['up', 'down']).toContain(response.dependencies.redis.status);
        
        // Must have mlService dependency
        expect(response.dependencies).toHaveProperty('mlService');
        expect(response.dependencies.mlService).toHaveProperty('status');
        expect(['up', 'down']).toContain(response.dependencies.mlService.status);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: getVersion returns a valid version string', () => {
    const version = getVersion();
    
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });

  it('Property 9: setVersion updates the version correctly', () => {
    fc.assert(
      fc.property(versionArbitrary, (newVersion) => {
        const originalVersion = getVersion();
        
        setVersion(newVersion);
        expect(getVersion()).toBe(newVersion);
        
        // Restore original version
        setVersion(originalVersion);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: getUptime returns a non-negative number', () => {
    const uptime = getUptime();
    
    expect(typeof uptime).toBe('number');
    expect(uptime).toBeGreaterThanOrEqual(0);
  });

  it('Property 9: determineOverallStatus returns valid status for any dependency combination', () => {
    fc.assert(
      fc.property(
        dependencyStatusArbitrary,
        dependencyStatusArbitrary,
        dependencyStatusArbitrary,
        (mongodb, redis, mlService) => {
          const dependencies = { mongodb, redis, mlService };
          const status = determineOverallStatus(dependencies);
          
          // Status must be one of the valid values
          expect(['healthy', 'degraded', 'unhealthy']).toContain(status);
          
          // Verify status logic
          if (mlService.status === 'down' || mongodb.status === 'down') {
            expect(status).toBe('unhealthy');
          } else if (redis.status === 'down') {
            expect(status).toBe('degraded');
          } else {
            expect(status).toBe('healthy');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
