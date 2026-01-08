/**
 * Property-based tests for Redis connection string parsing
 * Feature: infrastructure-deployment, Property 6: Redis Connection String Parsing
 * Validates: Requirements 7.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseRedisUri,
  parseRedisConfig,
  validateRedisConfig,
} from './redisClient';

describe('Redis Connection String Parsing', () => {
  /**
   * Property 6: Redis Connection String Parsing
   * For any valid Redis connection string (redis://, rediss://, redis-cluster://),
   * the Redis client SHALL correctly parse and establish connection with
   * appropriate TLS and authentication settings.
   * Validates: Requirements 7.6
   */
  describe('Property 6: Valid connection strings are correctly parsed', () => {
    // Generator for valid hostnames
    const hostnameArb = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
      { minLength: 1, maxLength: 20 }
    ).filter(s => !s.startsWith('-') && !s.endsWith('-'));

    // Generator for valid ports
    const portArb = fc.integer({ min: 1, max: 65535 });

    // Generator for valid passwords (alphanumeric for URL safety)
    const passwordArb = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')),
      { minLength: 1, maxLength: 32 }
    );

    // Generator for valid database numbers
    const dbArb = fc.integer({ min: 0, max: 15 });

    it('should correctly parse redis:// URIs with host and port', () => {
      fc.assert(
        fc.property(
          hostnameArb,
          portArb,
          (host, port) => {
            const uri = `redis://${host}:${port}`;
            const result = parseRedisUri(uri);
            
            expect(result).not.toBeNull();
            expect(result!.host).toBe(host);
            expect(result!.port).toBe(port);
            expect(result!.tls).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly parse rediss:// URIs with TLS enabled', () => {
      fc.assert(
        fc.property(
          hostnameArb,
          portArb,
          (host, port) => {
            const uri = `rediss://${host}:${port}`;
            const result = parseRedisUri(uri);
            
            expect(result).not.toBeNull();
            expect(result!.host).toBe(host);
            expect(result!.port).toBe(port);
            expect(result!.tls).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });


    it('should correctly parse redis-cluster:// URIs', () => {
      fc.assert(
        fc.property(
          hostnameArb,
          portArb,
          (host, port) => {
            const uri = `redis-cluster://${host}:${port}`;
            const result = parseRedisUri(uri);
            
            expect(result).not.toBeNull();
            expect(result!.host).toBe(host);
            expect(result!.port).toBe(port);
            // redis-cluster:// doesn't imply TLS by itself
            expect(result!.tls).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly parse URIs with password authentication', () => {
      fc.assert(
        fc.property(
          hostnameArb,
          portArb,
          passwordArb,
          (host, port, password) => {
            const uri = `redis://:${password}@${host}:${port}`;
            const result = parseRedisUri(uri);
            
            expect(result).not.toBeNull();
            expect(result!.host).toBe(host);
            expect(result!.port).toBe(port);
            expect(result!.password).toBe(password);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly parse URIs with database number', () => {
      fc.assert(
        fc.property(
          hostnameArb,
          portArb,
          dbArb,
          (host, port, db) => {
            const uri = `redis://${host}:${port}/${db}`;
            const result = parseRedisUri(uri);
            
            expect(result).not.toBeNull();
            expect(result!.host).toBe(host);
            expect(result!.port).toBe(port);
            expect(result!.db).toBe(db);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use default port 6379 when port is not specified', () => {
      fc.assert(
        fc.property(
          hostnameArb,
          (host) => {
            const uri = `redis://${host}`;
            const result = parseRedisUri(uri);
            
            expect(result).not.toBeNull();
            expect(result!.host).toBe(host);
            expect(result!.port).toBe(6379);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle complete URIs with all components', () => {
      fc.assert(
        fc.property(
          hostnameArb,
          portArb,
          passwordArb,
          dbArb,
          fc.boolean(),
          (host, port, password, db, useTls) => {
            const protocol = useTls ? 'rediss' : 'redis';
            const uri = `${protocol}://:${password}@${host}:${port}/${db}`;
            const result = parseRedisUri(uri);
            
            expect(result).not.toBeNull();
            expect(result!.host).toBe(host);
            expect(result!.port).toBe(port);
            expect(result!.password).toBe(password);
            expect(result!.db).toBe(db);
            expect(result!.tls).toBe(useTls);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('parseRedisConfig from environment', () => {
    it('should return null when REDIS_URI is not set', () => {
      const result = parseRedisConfig({});
      expect(result).toBeNull();
    });

    it('should detect TLS from rediss:// protocol', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('localhost', 'redis.example.com', '127.0.0.1'),
          fc.integer({ min: 1, max: 65535 }),
          (host, port) => {
            const env = {
              REDIS_URI: `rediss://${host}:${port}`,
            };

            const result = parseRedisConfig(env);
            expect(result).not.toBeNull();
            expect(result!.tls).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect cluster mode from redis-cluster:// protocol', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('localhost', 'redis.example.com', '127.0.0.1'),
          fc.integer({ min: 1, max: 65535 }),
          (host, port) => {
            const env = {
              REDIS_URI: `redis-cluster://${host}:${port}`,
            };

            const result = parseRedisConfig(env);
            expect(result).not.toBeNull();
            expect(result!.clusterMode).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect REDIS_TLS environment variable', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (tlsEnabled) => {
            const env = {
              REDIS_URI: 'redis://localhost:6379',
              REDIS_TLS: tlsEnabled ? 'true' : 'false',
            };

            const result = parseRedisConfig(env);
            expect(result).not.toBeNull();
            expect(result!.tls).toBe(tlsEnabled);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect REDIS_CLUSTER_MODE environment variable', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (clusterEnabled) => {
            const env = {
              REDIS_URI: 'redis://localhost:6379',
              REDIS_CLUSTER_MODE: clusterEnabled ? 'true' : 'false',
            };

            const result = parseRedisConfig(env);
            expect(result).not.toBeNull();
            expect(result!.clusterMode).toBe(clusterEnabled);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include password from environment', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')),
            { minLength: 1, maxLength: 32 }
          ),
          (password) => {
            const env = {
              REDIS_URI: 'redis://localhost:6379',
              REDIS_PASSWORD: password,
            };

            const result = parseRedisConfig(env);
            expect(result).not.toBeNull();
            expect(result!.password).toBe(password);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('validateRedisConfig', () => {
    it('should validate valid configurations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('redis://localhost:6379', 'rediss://redis.example.com:6380', 'redis-cluster://cluster.example.com:6379'),
          (uri) => {
            const result = validateRedisConfig({ uri });
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid retry delay values', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: -1 }),
          (retryDelayMs) => {
            const result = validateRedisConfig({
              uri: 'redis://localhost:6379',
              retryDelayMs,
            });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Retry delay'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid max retries values', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: -1 }),
          (maxRetries) => {
            const result = validateRedisConfig({
              uri: 'redis://localhost:6379',
              maxRetries,
            });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Max retries'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    it('should return null for empty or whitespace URIs', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', '   ', '\t', '\n'),
          (uri) => {
            const result = parseRedisUri(uri);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle host:port format without protocol', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('localhost', 'redis.example.com', '127.0.0.1'),
          fc.integer({ min: 1, max: 65535 }),
          (host, port) => {
            const uri = `${host}:${port}`;
            const result = parseRedisUri(uri);
            
            expect(result).not.toBeNull();
            expect(result!.host).toBe(host);
            expect(result!.port).toBe(port);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
