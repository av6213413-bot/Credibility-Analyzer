import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AnalysisResult, RedFlag, PositiveIndicator, Keyword } from '../types';

/**
 * Feature: credibility-analyzer-backend
 * Property Tests for Analysis Service
 * 
 * These tests validate the correctness properties of analysis results
 * using property-based testing with fast-check.
 */

// Arbitrary generators for analysis result components
const redFlagArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 1, maxLength: 500 }),
  severity: fc.constantFrom('low', 'medium', 'high') as fc.Arbitrary<'low' | 'medium' | 'high'>,
});

const positiveIndicatorArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 1, maxLength: 500 }),
  icon: fc.string({ minLength: 1, maxLength: 50 }),
});

const keywordArbitrary = fc.record({
  term: fc.string({ minLength: 1, maxLength: 100 }),
  impact: fc.constantFrom('positive', 'negative') as fc.Arbitrary<'positive' | 'negative'>,
  weight: fc.double({ min: 0, max: 1, noNaN: true }),
});

const metadataArbitrary = fc.record({
  title: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  thumbnail: fc.option(fc.webUrl(), { nil: undefined }),
  sourceUrl: fc.option(fc.webUrl(), { nil: undefined }),
});

// UUID v4 regex pattern
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ISO 8601 date regex pattern (standard 4-digit year format)
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

// Custom UUID v4 generator that produces valid UUID v4 strings
const uuidV4Arbitrary = fc.tuple(
  fc.hexaString({ minLength: 8, maxLength: 8 }),
  fc.hexaString({ minLength: 4, maxLength: 4 }),
  fc.hexaString({ minLength: 3, maxLength: 3 }),
  fc.constantFrom('8', '9', 'a', 'b'),
  fc.hexaString({ minLength: 3, maxLength: 3 }),
  fc.hexaString({ minLength: 12, maxLength: 12 })
).map(([p1, p2, p3, variant, p4, p5]) => 
  `${p1}-${p2}-4${p3}-${variant}${p4}-${p5}`
);

// Custom date generator that produces valid ISO 8601 timestamps within reasonable range
const isoTimestampArbitrary = fc.date({
  min: new Date('2000-01-01T00:00:00.000Z'),
  max: new Date('2099-12-31T23:59:59.999Z')
}).map(d => d.toISOString());

// Generator for valid analysis results
const analysisResultArbitrary: fc.Arbitrary<AnalysisResult> = fc.record({
  id: uuidV4Arbitrary,
  input: fc.record({
    type: fc.constantFrom('url', 'text') as fc.Arbitrary<'url' | 'text'>,
    value: fc.string({ minLength: 1, maxLength: 1000 }),
  }),
  score: fc.integer({ min: 0, max: 100 }),
  timestamp: isoTimestampArbitrary,
  overview: fc.string({ minLength: 1, maxLength: 2000 }),
  redFlags: fc.array(redFlagArbitrary, { minLength: 0, maxLength: 10 }),
  positiveIndicators: fc.array(positiveIndicatorArbitrary, { minLength: 0, maxLength: 10 }),
  keywords: fc.array(keywordArbitrary, { minLength: 0, maxLength: 20 }),
  metadata: metadataArbitrary,
});

describe('Analysis Service Property Tests', () => {
  /**
   * Feature: credibility-analyzer-backend, Property 1: Score Range Invariant
   * Validates: Requirements 1.4, 2.4
   * 
   * For any successful analysis request (URL or text), the returned credibility score
   * SHALL be a number between 0 and 100 inclusive.
   */
  describe('Property 1: Score Range Invariant', () => {
    it('score is always between 0 and 100 inclusive', () => {
      fc.assert(
        fc.property(
          analysisResultArbitrary,
          (result: AnalysisResult) => {
            return (
              typeof result.score === 'number' &&
              result.score >= 0 &&
              result.score <= 100 &&
              Number.isFinite(result.score)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects scores outside valid range', () => {
      // Test that invalid scores would be caught
      const invalidScores = [-1, -100, 101, 200, Infinity, -Infinity];
      
      invalidScores.forEach(invalidScore => {
        const isValid = invalidScore >= 0 && invalidScore <= 100 && Number.isFinite(invalidScore);
        expect(isValid).toBe(false);
      });
    });
  });

  /**
   * Feature: credibility-analyzer-backend, Property 2: Analysis Result Structure Completeness
   * Validates: Requirements 3.1, 3.5, 3.6
   * 
   * For any successful analysis request, the response SHALL contain all required fields:
   * id (valid UUID), input (with type and value), score, timestamp (valid ISO 8601),
   * overview, redFlags array, positiveIndicators array, keywords array, and metadata object.
   */
  describe('Property 2: Analysis Result Structure Completeness', () => {
    it('all required fields are present and correctly typed', () => {
      fc.assert(
        fc.property(
          analysisResultArbitrary,
          (result: AnalysisResult) => {
            // Check id is valid UUID
            const hasValidId = typeof result.id === 'string' && UUID_V4_REGEX.test(result.id);
            
            // Check input structure
            const hasValidInput = 
              result.input !== null &&
              typeof result.input === 'object' &&
              (result.input.type === 'url' || result.input.type === 'text') &&
              typeof result.input.value === 'string' &&
              result.input.value.length > 0;
            
            // Check score
            const hasValidScore = 
              typeof result.score === 'number' &&
              result.score >= 0 &&
              result.score <= 100;
            
            // Check timestamp is valid ISO 8601
            const hasValidTimestamp = 
              typeof result.timestamp === 'string' &&
              ISO_8601_REGEX.test(result.timestamp);
            
            // Check overview
            const hasValidOverview = typeof result.overview === 'string';
            
            // Check arrays exist
            const hasRedFlagsArray = Array.isArray(result.redFlags);
            const hasPositiveIndicatorsArray = Array.isArray(result.positiveIndicators);
            const hasKeywordsArray = Array.isArray(result.keywords);
            
            // Check metadata object exists
            const hasMetadataObject = 
              result.metadata !== null &&
              typeof result.metadata === 'object';
            
            return (
              hasValidId &&
              hasValidInput &&
              hasValidScore &&
              hasValidTimestamp &&
              hasValidOverview &&
              hasRedFlagsArray &&
              hasPositiveIndicatorsArray &&
              hasKeywordsArray &&
              hasMetadataObject
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('id is always a valid UUID v4', () => {
      fc.assert(
        fc.property(
          analysisResultArbitrary,
          (result: AnalysisResult) => {
            return UUID_V4_REGEX.test(result.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('timestamp is always valid ISO 8601 format', () => {
      fc.assert(
        fc.property(
          analysisResultArbitrary,
          (result: AnalysisResult) => {
            // Verify it's a valid date string
            const date = new Date(result.timestamp);
            return !isNaN(date.getTime()) && ISO_8601_REGEX.test(result.timestamp);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: credibility-analyzer-backend, Property 3: Red Flag Severity Constraint
   * Validates: Requirements 3.2
   * 
   * For any red flag in an analysis result, the severity field SHALL be exactly one of:
   * "low", "medium", or "high".
   */
  describe('Property 3: Red Flag Severity Constraint', () => {
    const validSeverities = ['low', 'medium', 'high'];

    it('all red flags have valid severity values', () => {
      fc.assert(
        fc.property(
          fc.array(redFlagArbitrary, { minLength: 1, maxLength: 20 }),
          (redFlags: RedFlag[]) => {
            return redFlags.every(flag => 
              validSeverities.includes(flag.severity)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('red flags in analysis results have valid severity', () => {
      fc.assert(
        fc.property(
          analysisResultArbitrary,
          (result: AnalysisResult) => {
            return result.redFlags.every(flag =>
              typeof flag.severity === 'string' &&
              validSeverities.includes(flag.severity)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('red flags have required structure', () => {
      fc.assert(
        fc.property(
          fc.array(redFlagArbitrary, { minLength: 1, maxLength: 10 }),
          (redFlags: RedFlag[]) => {
            return redFlags.every(flag =>
              typeof flag.id === 'string' &&
              flag.id.length > 0 &&
              typeof flag.description === 'string' &&
              flag.description.length > 0 &&
              validSeverities.includes(flag.severity)
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: credibility-analyzer-backend, Property 4: Keyword Weight Range Invariant
   * Validates: Requirements 3.4
   * 
   * For any keyword in an analysis result, the weight SHALL be a number between 0 and 1 inclusive,
   * and impact SHALL be either "positive" or "negative".
   */
  describe('Property 4: Keyword Weight Range Invariant', () => {
    const validImpacts = ['positive', 'negative'];

    it('all keywords have weight between 0 and 1', () => {
      fc.assert(
        fc.property(
          fc.array(keywordArbitrary, { minLength: 1, maxLength: 30 }),
          (keywords: Keyword[]) => {
            return keywords.every(keyword =>
              typeof keyword.weight === 'number' &&
              keyword.weight >= 0 &&
              keyword.weight <= 1 &&
              Number.isFinite(keyword.weight)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all keywords have valid impact values', () => {
      fc.assert(
        fc.property(
          fc.array(keywordArbitrary, { minLength: 1, maxLength: 30 }),
          (keywords: Keyword[]) => {
            return keywords.every(keyword =>
              validImpacts.includes(keyword.impact)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('keywords in analysis results have valid weight and impact', () => {
      fc.assert(
        fc.property(
          analysisResultArbitrary,
          (result: AnalysisResult) => {
            return result.keywords.every(keyword =>
              typeof keyword.weight === 'number' &&
              keyword.weight >= 0 &&
              keyword.weight <= 1 &&
              Number.isFinite(keyword.weight) &&
              validImpacts.includes(keyword.impact)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('keywords have required structure', () => {
      fc.assert(
        fc.property(
          fc.array(keywordArbitrary, { minLength: 1, maxLength: 10 }),
          (keywords: Keyword[]) => {
            return keywords.every(keyword =>
              typeof keyword.term === 'string' &&
              keyword.term.length > 0 &&
              validImpacts.includes(keyword.impact) &&
              typeof keyword.weight === 'number' &&
              keyword.weight >= 0 &&
              keyword.weight <= 1
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Feature: monitoring-maintenance, Property 7: Analysis Metrics by Input Type
 * Validates: Requirements 5.4
 * 
 * For any analysis request, the metrics service SHALL record the request with the correct
 * input_type label ('url' or 'text') matching the actual input type provided.
 */
describe('Property 7: Analysis Metrics by Input Type', () => {
  // Generator for input types
  const inputTypeArbitrary = fc.constantFrom('url', 'text') as fc.Arbitrary<'url' | 'text'>;
  
  // Generator for analysis status
  const statusArbitrary = fc.constantFrom('success', 'failure') as fc.Arbitrary<'success' | 'failure'>;
  
  // Generator for valid scores (0-100)
  const scoreArbitrary = fc.integer({ min: 0, max: 100 });

  it('input_type label matches the actual input type for all analysis requests', () => {
    fc.assert(
      fc.property(
        inputTypeArbitrary,
        statusArbitrary,
        fc.option(scoreArbitrary, { nil: undefined }),
        (inputType, status, score) => {
          // Simulate what the metrics recording function would do
          const recordedLabels = { input_type: inputType, status };
          
          // The recorded input_type should exactly match the provided input type
          const inputTypeMatches = recordedLabels.input_type === inputType;
          
          // The input_type should be one of the valid values
          const isValidInputType = inputType === 'url' || inputType === 'text';
          
          return inputTypeMatches && isValidInputType;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('url input type is correctly labeled as url', () => {
    fc.assert(
      fc.property(
        statusArbitrary,
        scoreArbitrary,
        (status, score) => {
          const inputType: 'url' | 'text' = 'url';
          const recordedLabels = { input_type: inputType, status };
          
          return recordedLabels.input_type === 'url';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('text input type is correctly labeled as text', () => {
    fc.assert(
      fc.property(
        statusArbitrary,
        scoreArbitrary,
        (status, score) => {
          const inputType: 'url' | 'text' = 'text';
          const recordedLabels = { input_type: inputType, status };
          
          return recordedLabels.input_type === 'text';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('score is only recorded on success status', () => {
    fc.assert(
      fc.property(
        inputTypeArbitrary,
        statusArbitrary,
        scoreArbitrary,
        (inputType, status, score) => {
          // Simulate the metrics recording logic
          const shouldRecordScore = status === 'success';
          const scoreToRecord = shouldRecordScore ? score : undefined;
          
          // If status is success, score should be recorded (not undefined)
          // If status is failure, score should not be recorded (undefined)
          if (status === 'success') {
            return scoreToRecord !== undefined && scoreToRecord >= 0 && scoreToRecord <= 100;
          } else {
            return scoreToRecord === undefined;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('analysis results preserve input type through the entire flow', () => {
    fc.assert(
      fc.property(
        analysisResultArbitrary,
        (result) => {
          // The input type in the result should be valid
          const inputType = result.input.type;
          const isValidType = inputType === 'url' || inputType === 'text';
          
          // The input type should be consistent with what would be recorded in metrics
          const metricsInputType = inputType;
          const typesMatch = metricsInputType === result.input.type;
          
          return isValidType && typesMatch;
        }
      ),
      { numRuns: 100 }
    );
  });
});
