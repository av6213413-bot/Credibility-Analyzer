/**
 * Property-based tests for MongoDB Unavailable Error Handling
 * Feature: infrastructure-deployment, Property 2: MongoDB Unavailable Error Handling
 * Validates: Requirements 4.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { AnalysisResult } from '../../types';
import { DatabaseError, save, findById, findRecent, deleteById } from './analysisRepository';
import { mongoClient } from '../mongoClient';

// Mock the mongoClient module
vi.mock('../mongoClient', () => ({
  mongoClient: {
    isConnected: vi.fn(),
    getDb: vi.fn(),
  },
}));

/**
 * Arbitrary generator for AnalysisResult
 */
const analysisResultArb: fc.Arbitrary<AnalysisResult> = fc.record({
  id: fc.uuid(),
  input: fc.record({
    type: fc.constantFrom('url', 'text') as fc.Arbitrary<'url' | 'text'>,
    value: fc.string({ minLength: 1, maxLength: 500 }),
  }),
  score: fc.integer({ min: 0, max: 100 }),
  timestamp: fc.date().map((d) => d.toISOString()),
  overview: fc.string({ minLength: 1, maxLength: 1000 }),
  redFlags: fc.array(
    fc.record({
      id: fc.uuid(),
      description: fc.string({ minLength: 1, maxLength: 200 }),
      severity: fc.constantFrom('low', 'medium', 'high') as fc.Arbitrary<'low' | 'medium' | 'high'>,
    }),
    { minLength: 0, maxLength: 3 }
  ),
  positiveIndicators: fc.array(
    fc.record({
      id: fc.uuid(),
      description: fc.string({ minLength: 1, maxLength: 200 }),
      icon: fc.string({ minLength: 1, maxLength: 50 }),
    }),
    { minLength: 0, maxLength: 3 }
  ),
  keywords: fc.array(
    fc.record({
      term: fc.string({ minLength: 1, maxLength: 50 }),
      impact: fc.constantFrom('positive', 'negative') as fc.Arbitrary<'positive' | 'negative'>,
      weight: fc.float({ min: 0, max: 1, noNaN: true }),
    }),
    { minLength: 0, maxLength: 5 }
  ),
  metadata: fc.record({
    title: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
    thumbnail: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
    sourceUrl: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
  }),
});


describe('MongoDB Unavailable Error Handling Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 2: MongoDB Unavailable Error Handling
   * For any database operation when MongoDB is unavailable, the API SHALL return
   * a 503 error with code "DATABASE_UNAVAILABLE" and a descriptive message.
   * Validates: Requirements 4.5
   */
  describe('Property 2: MongoDB Unavailable Error Handling', () => {
    it('should throw DATABASE_UNAVAILABLE error on save when not connected', async () => {
      // Mock MongoDB as disconnected
      vi.mocked(mongoClient.isConnected).mockReturnValue(false);

      await fc.assert(
        fc.asyncProperty(analysisResultArb, async (result) => {
          try {
            await save(result);
            // Should not reach here
            expect.fail('Expected DatabaseError to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(DatabaseError);
            const dbError = error as DatabaseError;
            expect(dbError.code).toBe('DATABASE_UNAVAILABLE');
            expect(dbError.statusCode).toBe(503);
            expect(dbError.message).toBeTruthy();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should throw DATABASE_UNAVAILABLE error on findById when not connected', async () => {
      vi.mocked(mongoClient.isConnected).mockReturnValue(false);

      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (id) => {
          try {
            await findById(id);
            expect.fail('Expected DatabaseError to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(DatabaseError);
            const dbError = error as DatabaseError;
            expect(dbError.code).toBe('DATABASE_UNAVAILABLE');
            expect(dbError.statusCode).toBe(503);
            expect(dbError.message).toBeTruthy();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should throw DATABASE_UNAVAILABLE error on findRecent when not connected', async () => {
      vi.mocked(mongoClient.isConnected).mockReturnValue(false);

      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 100 }), async (limit) => {
          try {
            await findRecent(limit);
            expect.fail('Expected DatabaseError to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(DatabaseError);
            const dbError = error as DatabaseError;
            expect(dbError.code).toBe('DATABASE_UNAVAILABLE');
            expect(dbError.statusCode).toBe(503);
            expect(dbError.message).toBeTruthy();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should throw DATABASE_UNAVAILABLE error on deleteById when not connected', async () => {
      vi.mocked(mongoClient.isConnected).mockReturnValue(false);

      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (id) => {
          try {
            await deleteById(id);
            expect.fail('Expected DatabaseError to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(DatabaseError);
            const dbError = error as DatabaseError;
            expect(dbError.code).toBe('DATABASE_UNAVAILABLE');
            expect(dbError.statusCode).toBe(503);
            expect(dbError.message).toBeTruthy();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should include suggestedAction in DATABASE_UNAVAILABLE errors', async () => {
      vi.mocked(mongoClient.isConnected).mockReturnValue(false);

      await fc.assert(
        fc.asyncProperty(analysisResultArb, async (result) => {
          try {
            await save(result);
            expect.fail('Expected DatabaseError to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(DatabaseError);
            const dbError = error as DatabaseError;
            expect(dbError.suggestedAction).toBeTruthy();
            expect(typeof dbError.suggestedAction).toBe('string');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should consistently return 503 status code for all unavailable scenarios', async () => {
      vi.mocked(mongoClient.isConnected).mockReturnValue(false);

      // Test all operations return 503
      const operations = [
        () => save({
          id: 'test-id',
          input: { type: 'url' as const, value: 'https://example.com' },
          score: 75,
          timestamp: new Date().toISOString(),
          overview: 'Test overview',
          redFlags: [],
          positiveIndicators: [],
          keywords: [],
          metadata: {},
        }),
        () => findById('test-id'),
        () => findRecent(10),
        () => deleteById('test-id'),
      ];

      for (const operation of operations) {
        try {
          await operation();
          expect.fail('Expected DatabaseError to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(DatabaseError);
          expect((error as DatabaseError).statusCode).toBe(503);
          expect((error as DatabaseError).code).toBe('DATABASE_UNAVAILABLE');
        }
      }
    });
  });
});
