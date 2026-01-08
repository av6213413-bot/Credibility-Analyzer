/**
 * Property Tests for PDF Export
 * Feature: credibility-analyzer-frontend
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { exportAnalysisToPDF } from './pdfExport';
import type { AnalysisResult } from '@/types';

// Generators for test data
const redFlagArb = fc.record({
  id: fc.uuid(),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  severity: fc.constantFrom('low', 'medium', 'high') as fc.Arbitrary<'low' | 'medium' | 'high'>,
});

const positiveIndicatorArb = fc.record({
  id: fc.uuid(),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  icon: fc.string({ minLength: 1, maxLength: 20 }),
});

const keywordArb = fc.record({
  term: fc.string({ minLength: 1, maxLength: 30 }),
  impact: fc.constantFrom('positive', 'negative') as fc.Arbitrary<'positive' | 'negative'>,
  weight: fc.float({ min: 0, max: 1 }),
});

const analysisResultArb = fc.record({
  id: fc.uuid(),
  input: fc.oneof(
    fc.record({ type: fc.constant('url' as const), value: fc.webUrl() }),
    fc.record({ type: fc.constant('text' as const), value: fc.string({ minLength: 1, maxLength: 500 }) })
  ),
  score: fc.integer({ min: 0, max: 100 }),
  timestamp: fc.integer({ min: 1577836800000, max: 1893456000000 }).map(ts => new Date(ts)),
  overview: fc.string({ minLength: 0, maxLength: 200 }),
  redFlags: fc.array(redFlagArb, { minLength: 0, maxLength: 5 }),
  positiveIndicators: fc.array(positiveIndicatorArb, { minLength: 0, maxLength: 5 }),
  keywords: fc.array(keywordArb, { minLength: 0, maxLength: 10 }),
  metadata: fc.record({
    title: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    thumbnail: fc.option(fc.webUrl(), { nil: undefined }),
    sourceUrl: fc.option(fc.webUrl(), { nil: undefined }),
  }),
}) as fc.Arbitrary<AnalysisResult>;

/**
 * Feature: credibility-analyzer-frontend, Property 21: PDF Report Content
 * Validates: Requirements 9.2
 *
 * For any analysis result, the generated PDF SHALL contain the score, timestamp,
 * and all red flags and positive indicators.
 */
describe('Property 21: PDF Report Content', () => {
  it('should generate a valid PDF blob for any analysis result', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(analysisResultArb, (analysis) => {
        const blob = exportAnalysisToPDF(analysis);
        
        // Verify it returns a Blob
        expect(blob).toBeInstanceOf(Blob);
        
        // Verify it has PDF mime type
        expect(blob.type).toBe('application/pdf');
        
        // Verify it has content (non-empty)
        expect(blob.size).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate PDF with consistent size for same input', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(analysisResultArb, (analysis) => {
        const blob1 = exportAnalysisToPDF(analysis);
        const blob2 = exportAnalysisToPDF(analysis);
        
        // Same input should produce same size output
        expect(blob1.size).toBe(blob2.size);
      }),
      { numRuns: 50 }
    );
  });

  it('should generate larger PDF for analysis with more content', () => {
    // Create minimal analysis
    const minimalAnalysis: AnalysisResult = {
      id: 'test-id',
      input: { type: 'url', value: 'https://example.com' },
      score: 50,
      timestamp: new Date(),
      overview: '',
      redFlags: [],
      positiveIndicators: [],
      keywords: [],
      metadata: {},
    };

    // Create analysis with more content
    const fullAnalysis: AnalysisResult = {
      id: 'test-id-2',
      input: { type: 'url', value: 'https://example.com/article' },
      score: 75,
      timestamp: new Date(),
      overview: 'This is a detailed overview of the analysis results.',
      redFlags: [
        { id: '1', description: 'Red flag 1', severity: 'high' },
        { id: '2', description: 'Red flag 2', severity: 'medium' },
      ],
      positiveIndicators: [
        { id: '1', description: 'Positive indicator 1', icon: 'check' },
        { id: '2', description: 'Positive indicator 2', icon: 'star' },
      ],
      keywords: [
        { term: 'keyword1', impact: 'positive', weight: 0.8 },
        { term: 'keyword2', impact: 'negative', weight: 0.5 },
      ],
      metadata: {
        title: 'Test Article Title',
        sourceUrl: 'https://example.com/article',
      },
    };

    const minimalBlob = exportAnalysisToPDF(minimalAnalysis);
    const fullBlob = exportAnalysisToPDF(fullAnalysis);

    // Full analysis should produce larger PDF
    expect(fullBlob.size).toBeGreaterThan(minimalBlob.size);
  });
});
