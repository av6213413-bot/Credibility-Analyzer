import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig, validateConfig, ConfigurationError, warnMissingOptionalVars } from './index';

// Mock the logger to prevent console output during tests
vi.mock('../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Configuration Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateConfig', () => {
    it('should throw ConfigurationError when ML_SERVICE_URL is missing in production', () => {
      const env = {
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv;

      expect(() => validateConfig(env)).toThrow(ConfigurationError);
      expect(() => validateConfig(env)).toThrow('Missing required environment variables: ML_SERVICE_URL');
    });

    it('should throw ConfigurationError when ML_SERVICE_URL is empty in production', () => {
      const env = {
        NODE_ENV: 'production',
        ML_SERVICE_URL: '   ',
      } as NodeJS.ProcessEnv;

      expect(() => validateConfig(env)).toThrow(ConfigurationError);
    });

    it('should not throw when ML_SERVICE_URL is provided in production', () => {
      const env = {
        NODE_ENV: 'production',
        ML_SERVICE_URL: 'http://ml-service:5000',
      } as NodeJS.ProcessEnv;

      expect(() => validateConfig(env)).not.toThrow();
    });

    it('should not throw when NODE_ENV is development without ML_SERVICE_URL', () => {
      const env = {
        NODE_ENV: 'development',
      } as NodeJS.ProcessEnv;

      expect(() => validateConfig(env)).not.toThrow();
    });
  });

  describe('loadConfig - default values', () => {
    it('should apply default port of 3001', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.port).toBe(3001);
    });

    it('should apply default mlServiceUrl', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.mlServiceUrl).toBe('http://localhost:5000');
    });

    it('should apply default corsOrigins', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.corsOrigins).toEqual(['http://localhost:3000']);
    });

    it('should apply default rateLimitWindow of 15 minutes', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.rateLimitWindow).toBe(15 * 60 * 1000);
    });

    it('should apply default rateLimitMax of 100', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.rateLimitMax).toBe(100);
    });

    it('should apply default nodeEnv of development', () => {
      const env = {} as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.nodeEnv).toBe('development');
    });

    it('should use provided environment values over defaults', () => {
      const env = {
        NODE_ENV: 'test',
        PORT: '4000',
        ML_SERVICE_URL: 'http://custom-ml:8000',
        CORS_ORIGINS: 'http://app1.com,http://app2.com',
        RATE_LIMIT_WINDOW_MS: '60000',
        RATE_LIMIT_MAX: '50',
      } as NodeJS.ProcessEnv;

      const config = loadConfig(env);

      expect(config.port).toBe(4000);
      expect(config.mlServiceUrl).toBe('http://custom-ml:8000');
      expect(config.corsOrigins).toEqual(['http://app1.com', 'http://app2.com']);
      expect(config.rateLimitWindow).toBe(60000);
      expect(config.rateLimitMax).toBe(50);
      expect(config.nodeEnv).toBe('test');
    });

    it('should handle invalid numeric values by using defaults', () => {
      const env = {
        NODE_ENV: 'development',
        PORT: 'invalid',
        RATE_LIMIT_MAX: 'not-a-number',
      } as NodeJS.ProcessEnv;

      const config = loadConfig(env);

      expect(config.port).toBe(3001);
      expect(config.rateLimitMax).toBe(100);
    });
  });

  describe('loadConfig - MongoDB configuration', () => {
    it('should apply default MongoDB pool size of 10', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.mongodb.poolSize).toBe(10);
    });

    it('should apply default MongoDB read preference of primary', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.mongodb.readPreference).toBe('primary');
    });

    it('should apply default MongoDB connect timeout of 30000ms', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.mongodb.connectTimeoutMS).toBe(30000);
    });

    it('should use provided MongoDB environment values', () => {
      const env = {
        NODE_ENV: 'development',
        MONGODB_URI: 'mongodb://localhost:27017/test',
        MONGODB_POOL_SIZE: '20',
        MONGODB_READ_PREFERENCE: 'secondaryPreferred',
        MONGODB_CONNECT_TIMEOUT_MS: '60000',
      } as NodeJS.ProcessEnv;

      const config = loadConfig(env);

      expect(config.mongodb.uri).toBe('mongodb://localhost:27017/test');
      expect(config.mongodb.poolSize).toBe(20);
      expect(config.mongodb.readPreference).toBe('secondaryPreferred');
      expect(config.mongodb.connectTimeoutMS).toBe(60000);
    });

    it('should use default for invalid read preference', () => {
      const env = {
        NODE_ENV: 'development',
        MONGODB_READ_PREFERENCE: 'invalid-preference',
      } as NodeJS.ProcessEnv;

      const config = loadConfig(env);
      expect(config.mongodb.readPreference).toBe('primary');
    });
  });

  describe('loadConfig - Redis configuration', () => {
    it('should apply default Redis TLS of false', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.redis.tls).toBe(false);
    });

    it('should apply default Redis cluster mode of false', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.redis.clusterMode).toBe(false);
    });

    it('should apply default Redis cache TTL of 3600 seconds', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.redis.cacheTtlSeconds).toBe(3600);
    });

    it('should use provided Redis environment values', () => {
      const env = {
        NODE_ENV: 'development',
        REDIS_URI: 'redis://localhost:6379',
        REDIS_TLS: 'true',
        REDIS_PASSWORD: 'secret',
        REDIS_CLUSTER_MODE: 'true',
        REDIS_CACHE_TTL: '7200',
      } as NodeJS.ProcessEnv;

      const config = loadConfig(env);

      expect(config.redis.uri).toBe('redis://localhost:6379');
      expect(config.redis.tls).toBe(true);
      expect(config.redis.password).toBe('secret');
      expect(config.redis.clusterMode).toBe(true);
      expect(config.redis.cacheTtlSeconds).toBe(7200);
    });

    it('should handle boolean parsing for TLS', () => {
      const envTrue = { NODE_ENV: 'development', REDIS_TLS: '1' } as NodeJS.ProcessEnv;
      const envFalse = { NODE_ENV: 'development', REDIS_TLS: '0' } as NodeJS.ProcessEnv;
      const envYes = { NODE_ENV: 'development', REDIS_TLS: 'yes' } as NodeJS.ProcessEnv;
      const envNo = { NODE_ENV: 'development', REDIS_TLS: 'no' } as NodeJS.ProcessEnv;

      expect(loadConfig(envTrue).redis.tls).toBe(true);
      expect(loadConfig(envFalse).redis.tls).toBe(false);
      expect(loadConfig(envYes).redis.tls).toBe(true);
      expect(loadConfig(envNo).redis.tls).toBe(false);
    });
  });

  describe('loadConfig - ML configuration', () => {
    it('should apply default ML service URL', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.ml.url).toBe('http://localhost:5000');
    });

    it('should apply default ML timeout of 30000ms', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.ml.timeout).toBe(30000);
    });

    it('should apply default ML useGpu of false', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const config = loadConfig(env);
      expect(config.ml.useGpu).toBe(false);
    });

    it('should use provided ML environment values', () => {
      const env = {
        NODE_ENV: 'development',
        ML_SERVICE_URL: 'http://ml-gpu:5000',
        ML_SERVICE_TIMEOUT_MS: '60000',
        ML_USE_GPU: 'true',
      } as NodeJS.ProcessEnv;

      const config = loadConfig(env);

      expect(config.ml.url).toBe('http://ml-gpu:5000');
      expect(config.ml.timeout).toBe(60000);
      expect(config.ml.useGpu).toBe(true);
    });
  });

  describe('warnMissingOptionalVars - graceful degradation', () => {
    it('should return warning when MONGODB_URI is missing', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const warnings = warnMissingOptionalVars(env);
      expect(warnings).toContain('MONGODB_URI not configured - database features will be unavailable');
    });

    it('should return warning when REDIS_URI is missing', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      const warnings = warnMissingOptionalVars(env);
      expect(warnings).toContain('REDIS_URI not configured - caching features will use in-memory fallback');
    });

    it('should not return warnings when both URIs are provided', () => {
      const env = {
        NODE_ENV: 'development',
        MONGODB_URI: 'mongodb://localhost:27017/test',
        REDIS_URI: 'redis://localhost:6379',
      } as NodeJS.ProcessEnv;
      const warnings = warnMissingOptionalVars(env);
      expect(warnings).toHaveLength(0);
    });

    it('should continue loading config even when optional vars are missing', () => {
      const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
      // Should not throw
      const config = loadConfig(env);
      expect(config).toBeDefined();
      expect(config.mongodb.uri).toBe('');
      expect(config.redis.uri).toBe('');
    });
  });
});
