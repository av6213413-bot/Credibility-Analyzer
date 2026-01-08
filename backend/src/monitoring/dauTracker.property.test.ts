/**
 * Feature: monitoring-maintenance, Property 6: Unique Daily Active Users
 * Validates: Requirements 5.1
 * 
 * For any set of requests from the same IP or session within a single day,
 * the daily active user counter SHALL increment by exactly 1, regardless
 * of the number of requests.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getCurrentDateKey,
  getDauRedisKey,
  getSecondsUntilMidnightUTC,
  hashIdentifier,
} from './dauTracker';

describe('DAU Tracker Property Tests', () => {
  /**
   * Feature: monitoring-maintenance, Property 6: Unique Daily Active Users
   * Validates: Requirements 5.1
   */
  describe('Property 6: Unique Daily Active Users', () => {
    // Generator for IP addresses
    const ipAddressArbitrary = fc.tuple(
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 })
    ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

    // Generator for session IDs
    const sessionIdArbitrary = fc.hexaString({ minLength: 16, maxLength: 32 });

    // Generator for user identifiers (either IP or session)
    const identifierArbitrary = fc.oneof(ipAddressArbitrary, sessionIdArbitrary);

    it('same identifier always produces the same hash', () => {
      fc.assert(
        fc.property(
          identifierArbitrary,
          (identifier) => {
            const hash1 = hashIdentifier(identifier);
            const hash2 = hashIdentifier(identifier);
            
            // Same identifier should always produce the same hash
            return hash1 === hash2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('different identifiers produce different hashes (with high probability)', () => {
      fc.assert(
        fc.property(
          identifierArbitrary,
          identifierArbitrary,
          (id1, id2) => {
            // Skip if identifiers are the same
            if (id1 === id2) return true;
            
            const hash1 = hashIdentifier(id1);
            const hash2 = hashIdentifier(id2);
            
            // Different identifiers should produce different hashes
            // (with very high probability for a good hash function)
            return hash1 !== hash2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('hash output is always a valid string starting with user_', () => {
      fc.assert(
        fc.property(
          identifierArbitrary,
          (identifier) => {
            const hash = hashIdentifier(identifier);
            
            // Hash should be a non-empty string starting with 'user_'
            return (
              typeof hash === 'string' &&
              hash.length > 0 &&
              hash.startsWith('user_')
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('tracking the same user multiple times should count as 1 unique user', () => {
      fc.assert(
        fc.property(
          identifierArbitrary,
          fc.integer({ min: 1, max: 100 }),
          (identifier, requestCount) => {
            // Simulate tracking the same user multiple times
            const trackedUsers = new Set<string>();
            
            for (let i = 0; i < requestCount; i++) {
              const hashedId = hashIdentifier(identifier);
              trackedUsers.add(hashedId);
            }
            
            // Regardless of how many times we track, the set should have exactly 1 entry
            return trackedUsers.size === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('tracking N different users should result in N unique entries', () => {
      fc.assert(
        fc.property(
          fc.array(identifierArbitrary, { minLength: 1, maxLength: 50 }),
          (identifiers) => {
            // Get unique identifiers
            const uniqueIdentifiers = [...new Set(identifiers)];
            
            // Track all users
            const trackedUsers = new Set<string>();
            for (const id of identifiers) {
              trackedUsers.add(hashIdentifier(id));
            }
            
            // The number of tracked users should equal the number of unique identifiers
            return trackedUsers.size === uniqueIdentifiers.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Date Key Generation', () => {
    it('getCurrentDateKey returns valid YYYY-MM-DD format', () => {
      const dateKey = getCurrentDateKey();
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      
      expect(dateRegex.test(dateKey)).toBe(true);
    });

    it('getDauRedisKey includes the date key', () => {
      fc.assert(
        fc.property(
          fc.date({
            min: new Date('2020-01-01'),
            max: new Date('2030-12-31')
          }),
          (date) => {
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`;
            
            const redisKey = getDauRedisKey(dateKey);
            
            // Redis key should contain the date key
            return redisKey.includes(dateKey) && redisKey.startsWith('dau:');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getSecondsUntilMidnightUTC returns positive value', () => {
      const seconds = getSecondsUntilMidnightUTC();
      
      // Should be positive and less than 24 hours
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(86400);
    });
  });

  describe('Hash Function Properties', () => {
    it('hash is deterministic', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (input) => {
            const hash1 = hashIdentifier(input);
            const hash2 = hashIdentifier(input);
            const hash3 = hashIdentifier(input);
            
            return hash1 === hash2 && hash2 === hash3;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('hash does not contain original IP address', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 })
          ),
          ([a, b, c, d]) => {
            const ip = `${a}.${b}.${c}.${d}`;
            const hash = hashIdentifier(ip);
            
            // Hash should not contain the original full IP address (PII protection)
            // The hash format is 'user_<hex>' so it shouldn't contain dots or the full IP
            return !hash.includes(ip) && !hash.includes('.');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
