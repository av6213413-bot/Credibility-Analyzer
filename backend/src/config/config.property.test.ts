/**
 * Property-based tests for Configuration Graceful Degradation
 * Feature: infrastructure-deployment, Property 7: Environment Variable Graceful Degradation
 * Validates: Requirements 9.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock the logger to capture warnings - must be before imports that use it
vi.mock('../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mock setup
import { loadConfig, warnMissingOptionalVars, validateConfig, ConfigurationError } from './index';
import { logger } from '../utils/logger';

// Cast logger.warn to a mock function for type safety
const mockWarn = logger.warn as ReturnType<typeof vi.fn>;

/**
 * Property 7: Environment Variable Graceful Degradation
 * 
 * For any missing optional database environment variable (MONGODB_URI, REDIS_URI),
 * the API SHALL log a warning and continue startup with degraded functionality
 * rather than failing.
 * 
 * Validates: Requirements 9.5
 */
describe('Property 7: Environment Variable Graceful Degradation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Graceful degradation for missing MONGODB_URI', () => {
    /**
     * Property: For any valid configuration without MONGODB_URI,
     * the system SHALL log a warning but continue loading config successfully
     */
    it('should log warning and continue when MONGODB_URI is missing', () => {
      fc.assert(
        fc.property(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'test'),
            PORT: fc.option(fc.integer({ min: 1000, max: 65535 }).map(String), { nil: undefined }),
            REDIS_URI: fc.option(fc.constant('redis://localhost:6379'), { nil: undefined }),
          }),
          (envPartial) => {
            const env = { ...envPartial } as NodeJS.ProcessEnv;
            
            // Should not throw
            const config = loadConfig(env);
            
            // Config should be valid
            expect(config).toBeDefined();
            expect(config.mongodb).toBeDefined();
            expect(config.mongodb.uri).toBe('');
            
            // Warning should be logged
            expect(mockWarn).toHaveBeenCalledWith(
              'MONGODB_URI not configured - database features will be unavailable'
            );
            
            mockWarn.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Graceful degradation for missing REDIS_URI', () => {
    /**
     * Property: For any valid configuration without REDIS_URI,
     * the system SHALL log a warning but continue loading config successfully
     */
    it('should log warning and continue when REDIS_URI is missing', () => {
      fc.assert(
        fc.property(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'test'),
            PORT: fc.option(fc.integer({ min: 1000, max: 65535 }).map(String), { nil: undefined }),
            MONGODB_URI: fc.option(fc.constant('mongodb://localhost:27017/test'), { nil: undefined }),
          }),
          (envPartial) => {
            const env = { ...envPartial } as NodeJS.ProcessEnv;
            
            // Should not throw
            const config = loadConfig(env);
            
            // Config should be valid
            expect(config).toBeDefined();
            expect(config.redis).toBeDefined();
            expect(config.redis.uri).toBe('');
            
            // Warning should be logged
            expect(mockWarn).toHaveBeenCalledWith(
              'REDIS_URI not configured - caching features will use in-memory fallback'
            );
            
            mockWarn.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Graceful degradation for both missing URIs', () => {
    /**
     * Property: For any valid configuration without both MONGODB_URI and REDIS_URI,
     * the system SHALL log warnings for both but continue loading config successfully
     */
    it('should log warnings for both and continue when both URIs are missing', () => {
      fc.assert(
        fc.property(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'test'),
            PORT: fc.option(fc.integer({ min: 1000, max: 65535 }).map(String), { nil: undefined }),
            CORS_ORIGINS: fc.option(fc.constant('http://localhost:3000'), { nil: undefined }),
          }),
          (envPartial) => {
            const env = { ...envPartial } as NodeJS.ProcessEnv;
            
            // Should not throw
            const config = loadConfig(env);
            
            // Config should be valid with empty URIs
            expect(config).toBeDefined();
            expect(config.mongodb.uri).toBe('');
            expect(config.redis.uri).toBe('');
            
            // Both warnings should be logged
            expect(mockWarn).toHaveBeenCalledWith(
              'MONGODB_URI not configured - database features will be unavailable'
            );
            expect(mockWarn).toHaveBeenCalledWith(
              'REDIS_URI not configured - caching features will use in-memory fallback'
            );
            
            mockWarn.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('No warnings when URIs are provided', () => {
    /**
     * Property: For any valid configuration with both MONGODB_URI and REDIS_URI,
     * the system SHALL NOT log any warnings about missing database configuration
     */
    it('should not log warnings when both URIs are provided', () => {
      fc.assert(
        fc.property(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'test'),
            PORT: fc.option(fc.integer({ min: 1000, max: 65535 }).map(String), { nil: undefined }),
            MONGODB_URI: fc.constant('mongodb://localhost:27017/test'),
            REDIS_URI: fc.constant('redis://localhost:6379'),
          }),
          (envPartial) => {
            const env = { ...envPartial } as NodeJS.ProcessEnv;
            
            // Should not throw
            const config = loadConfig(env);
            
            // Config should have the URIs
            expect(config.mongodb.uri).toBe('mongodb://localhost:27017/test');
            expect(config.redis.uri).toBe('redis://localhost:6379');
            
            // No warnings about missing URIs should be logged
            expect(mockWarn).not.toHaveBeenCalledWith(
              expect.stringContaining('MONGODB_URI not configured')
            );
            expect(mockWarn).not.toHaveBeenCalledWith(
              expect.stringContaining('REDIS_URI not configured')
            );
            
            mockWarn.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('warnMissingOptionalVars returns correct warnings', () => {
    /**
     * Property: warnMissingOptionalVars returns an array of warning messages
     * for each missing optional variable
     */
    it('should return correct number of warnings based on missing vars', () => {
      fc.assert(
        fc.property(
          fc.record({
            MONGODB_URI: fc.option(fc.constant('mongodb://localhost:27017/test'), { nil: undefined }),
            REDIS_URI: fc.option(fc.constant('redis://localhost:6379'), { nil: undefined }),
          }),
          (envPartial) => {
            const env = { ...envPartial } as NodeJS.ProcessEnv;
            
            const warnings = warnMissingOptionalVars(env);
            
            let expectedWarnings = 0;
            if (!env.MONGODB_URI) expectedWarnings++;
            if (!env.REDIS_URI) expectedWarnings++;
            
            expect(warnings.length).toBe(expectedWarnings);
            
            mockWarn.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Config defaults are applied with graceful degradation', () => {
    /**
     * Property: For any missing optional environment variable,
     * the system SHALL apply sensible defaults while continuing startup
     */
    it('should apply default values for all optional config when vars are missing', () => {
      fc.assert(
        fc.property(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'test'),
          }),
          (envPartial) => {
            const env = { ...envPartial } as NodeJS.ProcessEnv;
            
            // Should not throw
            const config = loadConfig(env);
            
            // All defaults should be applied
            expect(config.port).toBe(3001);
            expect(config.mlServiceUrl).toBe('http://localhost:5000');
            expect(config.corsOrigins).toEqual(['http://localhost:3000']);
            expect(config.rateLimitWindow).toBe(15 * 60 * 1000);
            expect(config.rateLimitMax).toBe(100);
            
            // MongoDB defaults
            expect(config.mongodb.poolSize).toBe(10);
            expect(config.mongodb.readPreference).toBe('primary');
            expect(config.mongodb.connectTimeoutMS).toBe(30000);
            
            // Redis defaults
            expect(config.redis.tls).toBe(false);
            expect(config.redis.clusterMode).toBe(false);
            expect(config.redis.cacheTtlSeconds).toBe(3600);
            
            // ML defaults
            expect(config.ml.url).toBe('http://localhost:5000');
            expect(config.ml.timeout).toBe(30000);
            expect(config.ml.useGpu).toBe(false);
            
            mockWarn.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Required variables still throw in production', () => {
    /**
     * Property: Graceful degradation only applies to optional variables.
     * Required variables (like ML_SERVICE_URL in production) should still throw.
     */
    it('should still throw for required variables in production', () => {
      fc.assert(
        fc.property(
          fc.record({
            NODE_ENV: fc.constant('production'),
            // Intentionally missing ML_SERVICE_URL
          }),
          (envPartial) => {
            const env = { ...envPartial } as NodeJS.ProcessEnv;
            
            // Should throw ConfigurationError for missing required var
            expect(() => validateConfig(env)).toThrow(ConfigurationError);
            expect(() => validateConfig(env)).toThrow('ML_SERVICE_URL');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not throw for required variables when provided in production', () => {
      fc.assert(
        fc.property(
          fc.record({
            NODE_ENV: fc.constant('production'),
            ML_SERVICE_URL: fc.webUrl(),
          }),
          (envPartial) => {
            const env = { ...envPartial } as NodeJS.ProcessEnv;
            
            // Should not throw
            expect(() => validateConfig(env)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
