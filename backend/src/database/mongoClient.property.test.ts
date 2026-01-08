/**
 * Property-based tests for MongoDB configuration parsing
 * Feature: infrastructure-deployment, Property 3: MongoDB Configuration Parsing
 * Validates: Requirements 5.3, 6.3, 6.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateMongoConfig,
  parseMongoConfig,
  ReadPreferenceType,
} from './mongoClient';

const VALID_READ_PREFERENCES: ReadPreferenceType[] = [
  'primary',
  'primaryPreferred',
  'secondary',
  'secondaryPreferred',
  'nearest',
];

describe('MongoDB Configuration Parsing', () => {
  /**
   * Property 3: MongoDB Configuration Parsing
   * For any valid MongoDB configuration value (pool size 1-100, read preference in
   * [primary, primaryPreferred, secondary, secondaryPreferred, nearest]),
   * the configuration SHALL be correctly parsed and applied to the MongoDB client.
   * Validates: Requirements 5.3, 6.3, 6.4
   */
  describe('Property 3: Valid configurations are correctly parsed', () => {
    it('should validate pool sizes between 1 and 100', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (poolSize) => {
            const result = validateMongoConfig({ poolSize });
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject pool sizes outside 1-100 range', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ max: 0 }),
            fc.integer({ min: 101 })
          ),
          (poolSize) => {
            const result = validateMongoConfig({ poolSize });
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Pool size must be between 1 and 100');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate all valid read preferences', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...VALID_READ_PREFERENCES),
          (readPreference) => {
            const result = validateMongoConfig({ readPreference });
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid read preferences', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !VALID_READ_PREFERENCES.includes(s as ReadPreferenceType)),
          (readPreference) => {
            const result = validateMongoConfig({ readPreference: readPreference as ReadPreferenceType });
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Invalid read preference');
          }
        ),
        { numRuns: 100 }
      );
    });


    it('should correctly parse valid pool size and read preference combinations', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.constantFrom(...VALID_READ_PREFERENCES),
          (poolSize, readPreference) => {
            const result = validateMongoConfig({ poolSize, readPreference });
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('parseMongoConfig from environment', () => {
    it('should return null when MONGODB_URI is not set', () => {
      const result = parseMongoConfig({});
      expect(result).toBeNull();
    });

    it('should parse valid configurations from environment', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.constantFrom(...VALID_READ_PREFERENCES),
          (poolSize, readPreference) => {
            const env = {
              MONGODB_URI: 'mongodb://localhost:27017/test',
              MONGODB_POOL_SIZE: poolSize.toString(),
              MONGODB_READ_PREFERENCE: readPreference,
            };

            const result = parseMongoConfig(env);
            expect(result).not.toBeNull();
            expect(result!.uri).toBe('mongodb://localhost:27017/test');
            expect(result!.poolSize).toBe(poolSize);
            expect(result!.readPreference).toBe(readPreference);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use defaults for missing optional values', () => {
      const env = {
        MONGODB_URI: 'mongodb://localhost:27017/test',
      };

      const result = parseMongoConfig(env);
      expect(result).not.toBeNull();
      expect(result!.poolSize).toBe(10); // default
      expect(result!.readPreference).toBe('primary'); // default
      expect(result!.connectTimeoutMS).toBe(30000); // default
    });

    it('should use defaults when invalid values are provided', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ max: 0 }),
            fc.integer({ min: 101 })
          ),
          (invalidPoolSize) => {
            const env = {
              MONGODB_URI: 'mongodb://localhost:27017/test',
              MONGODB_POOL_SIZE: invalidPoolSize.toString(),
            };

            const result = parseMongoConfig(env);
            expect(result).not.toBeNull();
            // Should fall back to default when invalid
            expect(result!.poolSize).toBe(10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
