/**
 * Feature: credibility-analyzer-frontend, Property 19: Analysis Storage Round-Trip
 * Validates: Requirements 8.1
 *
 * For any valid AnalysisResult, persisting to storage then retrieving SHALL return an equivalent object.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { storageService } from './storageService';
import type { AnalysisResult, RedFlag, PositiveIndicator, Keyword, AnalysisInput } from '@/types';

// Arbitrary generators for AnalysisResult components
const analysisInputArb: fc.Arbitrary<AnalysisInput> = fc.record({
  type: fc.oneof(fc.constant('url' as const), fc.constant('text' as const)),
  value: fc.string({ minLength: 1, maxLength: 500 }),
});

const redFlagArb: fc.Arbitrary<RedFlag> = fc.record({
  id: fc.uuid(),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  severity: fc.oneof(
    fc.constant('low' as const),
    fc.constant('medium' as const),
    fc.constant('high' as const)
  ),
});

const positiveIndicatorArb: fc.Arbitrary<PositiveIndicator> = fc.record({
  id: fc.uuid(),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  icon: fc.string({ minLength: 1, maxLength: 50 }),
});

const keywordArb: fc.Arbitrary<Keyword> = fc.record({
  term: fc.string({ minLength: 1, maxLength: 50 }),
  impact: fc.oneof(fc.constant('positive' as const), fc.constant('negative' as const)),
  weight: fc.float({ min: 0, max: 1, noNaN: true }),
});

// Custom date arbitrary that ensures valid dates
const validDateArb: fc.Arbitrary<Date> = fc
  .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
  .map((timestamp) => new Date(timestamp));

const analysisResultArb: fc.Arbitrary<AnalysisResult> = fc.record({
  id: fc.uuid(),
  input: analysisInputArb,
  score: fc.integer({ min: 0, max: 100 }),
  timestamp: validDateArb,
  overview: fc.string({ minLength: 1, maxLength: 500 }),
  redFlags: fc.array(redFlagArb, { minLength: 0, maxLength: 5 }),
  positiveIndicators: fc.array(positiveIndicatorArb, { minLength: 0, maxLength: 5 }),
  keywords: fc.array(keywordArb, { minLength: 0, maxLength: 10 }),
  metadata: fc.record({
    title: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    thumbnail: fc.option(fc.webUrl(), { nil: undefined }),
    sourceUrl: fc.option(fc.webUrl(), { nil: undefined }),
  }),
});

describe('Property 19: Analysis Storage Round-Trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should persist and retrieve analysis result correctly (round-trip)', () => {
    fc.assert(
      fc.property(analysisResultArb, (analysisResult) => {
        // Clear history first
        storageService.clearHistory();

        // Add the analysis result to history
        storageService.addToHistory(analysisResult);

        // Retrieve history
        const history = storageService.getHistory();

        // Should have exactly one item
        expect(history).toHaveLength(1);

        const retrieved = history[0];

        // Verify all fields match (except timestamp which needs special handling)
        expect(retrieved.id).toBe(analysisResult.id);
        expect(retrieved.input).toEqual(analysisResult.input);
        expect(retrieved.score).toBe(analysisResult.score);
        expect(retrieved.overview).toBe(analysisResult.overview);
        expect(retrieved.redFlags).toEqual(analysisResult.redFlags);
        expect(retrieved.positiveIndicators).toEqual(analysisResult.positiveIndicators);
        expect(retrieved.keywords).toEqual(analysisResult.keywords);
        expect(retrieved.metadata).toEqual(analysisResult.metadata);

        // Timestamp should be equivalent (comparing time values due to Date serialization)
        expect(retrieved.timestamp.getTime()).toBe(analysisResult.timestamp.getTime());
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain order when adding multiple analysis results', () => {
    fc.assert(
      fc.property(
        fc.array(analysisResultArb, { minLength: 1, maxLength: 5 }),
        (analysisResults) => {
          // Clear history first
          storageService.clearHistory();

          // Add all results
          for (const result of analysisResults) {
            storageService.addToHistory(result);
          }

          // Retrieve history
          const history = storageService.getHistory();

          // Should have all items
          expect(history).toHaveLength(analysisResults.length);

          // Items should be in reverse order (most recent first)
          for (let i = 0; i < analysisResults.length; i++) {
            const expectedIndex = analysisResults.length - 1 - i;
            expect(history[i].id).toBe(analysisResults[expectedIndex].id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve analysis result after delete of different item', () => {
    fc.assert(
      fc.property(
        fc.array(analysisResultArb, { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 0 }),
        (analysisResults, deleteIndexSeed) => {
          // Ensure unique IDs
          const uniqueResults = analysisResults.map((r, i) => ({
            ...r,
            id: `${r.id}-${i}`,
          }));

          // Clear history first
          storageService.clearHistory();

          // Add all results
          for (const result of uniqueResults) {
            storageService.addToHistory(result);
          }

          // Pick an item to delete
          const deleteIndex = deleteIndexSeed % uniqueResults.length;
          const itemToDelete = uniqueResults[deleteIndex];

          // Delete the item
          storageService.deleteFromHistory(itemToDelete.id);

          // Retrieve history
          const history = storageService.getHistory();

          // Should have one less item
          expect(history).toHaveLength(uniqueResults.length - 1);

          // Deleted item should not be present
          expect(history.find((h) => h.id === itemToDelete.id)).toBeUndefined();

          // All other items should still be present
          for (const result of uniqueResults) {
            if (result.id !== itemToDelete.id) {
              expect(history.find((h) => h.id === result.id)).toBeDefined();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
