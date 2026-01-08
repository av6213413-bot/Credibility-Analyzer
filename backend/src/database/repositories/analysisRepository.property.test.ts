/**
 * Property-based tests for Analysis Repository
 * Feature: infrastructure-deployment, Property 1: MongoDB Storage Completeness
 * Validates: Requirements 4.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AnalysisResult } from '../../types';
import {
  toAnalysisDocument,
  fromAnalysisDocument,
  validateAnalysisDocument,
} from '../schemas/analysisSchema';

/**
 * Arbitrary generator for RedFlag
 */
const redFlagArb = fc.record({
  id: fc.uuid(),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  severity: fc.constantFrom('low', 'medium', 'high') as fc.Arbitrary<'low' | 'medium' | 'high'>,
});

/**
 * Arbitrary generator for PositiveIndicator
 */
const positiveIndicatorArb = fc.record({
  id: fc.uuid(),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  icon: fc.string({ minLength: 1, maxLength: 50 }),
});

/**
 * Arbitrary generator for Keyword
 */
const keywordArb = fc.record({
  term: fc.string({ minLength: 1, maxLength: 50 }),
  impact: fc.constantFrom('positive', 'negative') as fc.Arbitrary<'positive' | 'negative'>,
  weight: fc.float({ min: 0, max: 1, noNaN: true }),
});


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
  redFlags: fc.array(redFlagArb, { minLength: 0, maxLength: 5 }),
  positiveIndicators: fc.array(positiveIndicatorArb, { minLength: 0, maxLength: 5 }),
  keywords: fc.array(keywordArb, { minLength: 0, maxLength: 10 }),
  metadata: fc.record({
    title: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
    thumbnail: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
    sourceUrl: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
  }),
});

describe('Analysis Repository Property Tests', () => {
  /**
   * Property 1: MongoDB Storage Completeness
   * For any AnalysisResult saved to MongoDB, the stored document SHALL contain
   * all required fields: id, input (with type and value), score, timestamp,
   * overview, redFlags, positiveIndicators, keywords, and metadata.
   * Validates: Requirements 4.3
   */
  describe('Property 1: MongoDB Storage Completeness', () => {
    it('should preserve all required fields when converting to document', () => {
      fc.assert(
        fc.property(analysisResultArb, (result) => {
          const document = toAnalysisDocument(result);

          // Verify all required fields are present
          expect(document.id).toBe(result.id);
          expect(document.input).toEqual(result.input);
          expect(document.input.type).toBe(result.input.type);
          expect(document.input.value).toBe(result.input.value);
          expect(document.score).toBe(result.score);
          expect(document.timestamp).toBe(result.timestamp);
          expect(document.overview).toBe(result.overview);
          expect(document.redFlags).toEqual(result.redFlags);
          expect(document.positiveIndicators).toEqual(result.positiveIndicators);
          expect(document.keywords).toEqual(result.keywords);
          expect(document.metadata).toEqual(result.metadata);

          // Verify MongoDB-specific fields are added
          expect(document.createdAt).toBeInstanceOf(Date);
          expect(document.updatedAt).toBeInstanceOf(Date);
        }),
        { numRuns: 100 }
      );
    });

    it('should round-trip AnalysisResult through document conversion', () => {
      fc.assert(
        fc.property(analysisResultArb, (result) => {
          const document = toAnalysisDocument(result);
          const restored = fromAnalysisDocument(document);

          // Verify round-trip preserves all data
          expect(restored.id).toBe(result.id);
          expect(restored.input).toEqual(result.input);
          expect(restored.score).toBe(result.score);
          expect(restored.timestamp).toBe(result.timestamp);
          expect(restored.overview).toBe(result.overview);
          expect(restored.redFlags).toEqual(result.redFlags);
          expect(restored.positiveIndicators).toEqual(result.positiveIndicators);
          expect(restored.keywords).toEqual(result.keywords);
          expect(restored.metadata).toEqual(result.metadata);

          // Verify MongoDB fields are stripped
          expect((restored as unknown as Record<string, unknown>).createdAt).toBeUndefined();
          expect((restored as unknown as Record<string, unknown>).updatedAt).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should validate documents with all required fields', () => {
      fc.assert(
        fc.property(analysisResultArb, (result) => {
          const isValid = validateAnalysisDocument(result);
          expect(isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject documents missing required fields', () => {
      // Test missing id
      expect(validateAnalysisDocument({ input: { type: 'url', value: 'test' } })).toBe(false);

      // Test missing input
      expect(validateAnalysisDocument({ id: 'test-id' })).toBe(false);

      // Test invalid input type
      expect(validateAnalysisDocument({
        id: 'test-id',
        input: { type: 'invalid', value: 'test' },
      })).toBe(false);

      // Test null/undefined
      expect(validateAnalysisDocument(null)).toBe(false);
      expect(validateAnalysisDocument(undefined)).toBe(false);
    });

    it('should preserve redFlags array structure', () => {
      fc.assert(
        fc.property(
          fc.array(redFlagArb, { minLength: 1, maxLength: 10 }),
          analysisResultArb,
          (redFlags, baseResult) => {
            const result = { ...baseResult, redFlags };
            const document = toAnalysisDocument(result);
            const restored = fromAnalysisDocument(document);

            expect(restored.redFlags).toHaveLength(redFlags.length);
            restored.redFlags.forEach((flag, index) => {
              expect(flag.id).toBe(redFlags[index].id);
              expect(flag.description).toBe(redFlags[index].description);
              expect(flag.severity).toBe(redFlags[index].severity);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve positiveIndicators array structure', () => {
      fc.assert(
        fc.property(
          fc.array(positiveIndicatorArb, { minLength: 1, maxLength: 10 }),
          analysisResultArb,
          (indicators, baseResult) => {
            const result = { ...baseResult, positiveIndicators: indicators };
            const document = toAnalysisDocument(result);
            const restored = fromAnalysisDocument(document);

            expect(restored.positiveIndicators).toHaveLength(indicators.length);
            restored.positiveIndicators.forEach((indicator, index) => {
              expect(indicator.id).toBe(indicators[index].id);
              expect(indicator.description).toBe(indicators[index].description);
              expect(indicator.icon).toBe(indicators[index].icon);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve keywords array structure', () => {
      fc.assert(
        fc.property(
          fc.array(keywordArb, { minLength: 1, maxLength: 10 }),
          analysisResultArb,
          (keywords, baseResult) => {
            const result = { ...baseResult, keywords };
            const document = toAnalysisDocument(result);
            const restored = fromAnalysisDocument(document);

            expect(restored.keywords).toHaveLength(keywords.length);
            restored.keywords.forEach((keyword, index) => {
              expect(keyword.term).toBe(keywords[index].term);
              expect(keyword.impact).toBe(keywords[index].impact);
              expect(keyword.weight).toBe(keywords[index].weight);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
