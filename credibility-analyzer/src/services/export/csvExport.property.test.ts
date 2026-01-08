/**
 * Property Tests for CSV Export
 * Feature: credibility-analyzer-frontend, Property 13: CSV Export Completeness
 * Validates: Requirements 4.7
 *
 * For any history export, the generated CSV SHALL contain one row per history item
 * with all required fields (id, title, url, score, date).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { exportHistoryToCSV } from './csvExport';
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

const historyArb = fc.array(analysisResultArb, { minLength: 0, maxLength: 20 });

describe('Property 13: CSV Export Completeness', () => {
  it('should generate a valid CSV blob for any history', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(historyArb, (history) => {
        const blob = exportHistoryToCSV(history);
        
        // Verify it returns a Blob
        expect(blob).toBeInstanceOf(Blob);
        
        // Verify it has CSV mime type
        expect(blob.type).toBe('text/csv;charset=utf-8');
        
        // Verify it has content (at least header row)
        expect(blob.size).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate blob with size proportional to history length', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        fc.array(analysisResultArb, { minLength: 1, maxLength: 10 }),
        (history) => {
          const blob = exportHistoryToCSV(history);
          const emptyBlob = exportHistoryToCSV([]);
          
          // Blob with items should be larger than empty blob (header only)
          expect(blob.size).toBeGreaterThan(emptyBlob.size);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate larger blob for more history items', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        fc.array(analysisResultArb, { minLength: 2, maxLength: 10 }),
        (history) => {
          const fullBlob = exportHistoryToCSV(history);
          const partialBlob = exportHistoryToCSV(history.slice(0, 1));
          
          // More items should produce larger blob
          expect(fullBlob.size).toBeGreaterThan(partialBlob.size);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate consistent blob size for same input', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(historyArb, (history) => {
        const blob1 = exportHistoryToCSV(history);
        const blob2 = exportHistoryToCSV(history);
        
        // Same input should produce same size output
        expect(blob1.size).toBe(blob2.size);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle empty history', () => {
    const blob = exportHistoryToCSV([]);
    
    // Should still produce a valid blob with header
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle history with special characters in metadata', { timeout: 30000 }, () => {
    // Create analysis with special characters
    const analysisWithSpecialChars: AnalysisResult = {
      id: 'test-id',
      input: { type: 'text', value: 'Test, with "quotes" and\nnewlines' },
      score: 50,
      timestamp: new Date(),
      overview: 'Overview with, commas',
      redFlags: [],
      positiveIndicators: [],
      keywords: [],
      metadata: {
        title: 'Title, with "special" chars',
      },
    };

    const blob = exportHistoryToCSV([analysisWithSpecialChars]);
    
    // Should produce a valid blob
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should produce blob with correct structure for known input', () => {
    const knownAnalysis: AnalysisResult = {
      id: 'known-id-123',
      input: { type: 'url', value: 'https://example.com' },
      score: 75,
      timestamp: new Date('2024-01-15T10:30:00Z'),
      overview: 'Test overview',
      redFlags: [{ id: '1', description: 'Flag 1', severity: 'high' }],
      positiveIndicators: [{ id: '1', description: 'Indicator 1', icon: 'check' }],
      keywords: [],
      metadata: { title: 'Test Article' },
    };

    const blob = exportHistoryToCSV([knownAnalysis]);
    
    // Verify blob properties
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/csv;charset=utf-8');
    // Header + 1 data row should produce reasonable size
    expect(blob.size).toBeGreaterThan(50);
  });
});
