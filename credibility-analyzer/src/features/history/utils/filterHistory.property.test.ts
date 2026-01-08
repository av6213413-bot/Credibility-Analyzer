/**
 * Property Tests for History Filter Functions
 * Feature: credibility-analyzer-frontend
 * Property 9: Date Range Filter Correctness - Validates: Requirements 4.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterByDateRange } from './filterHistory';
import type { HistoryItem } from '@/types';

// Valid date generator using integer timestamps
const validDateArb = fc.integer({ 
  min: new Date('2020-01-01').getTime(), 
  max: new Date('2030-12-31').getTime() 
}).map(ts => new Date(ts));

// Generator for valid history items
const historyItemArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  url: fc.option(fc.webUrl(), { nil: undefined }),
  score: fc.integer({ min: 0, max: 100 }),
  timestamp: validDateArb,
  thumbnail: fc.option(fc.webUrl(), { nil: undefined }),
}) as fc.Arbitrary<HistoryItem>;

// Generator for arrays of history items
const historyItemsArb = fc.array(historyItemArb, { minLength: 0, maxLength: 50 });

// Generator for date range with start <= end
const dateRangeArb = fc.tuple(validDateArb, validDateArb).map(([d1, d2]) => {
  const sorted = [d1, d2].sort((a, b) => a.getTime() - b.getTime());
  return { start: sorted[0], end: sorted[1] };
});

// Helper to normalize date to start of day for comparison
const normalizeDate = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

describe('Property 9: Date Range Filter Correctness', () => {
  it('should return only items within the date range (inclusive)', () => {
    fc.assert(
      fc.property(historyItemsArb, dateRangeArb, (items, dateRange) => {
        const filtered = filterByDateRange(items, dateRange);
        const startNormalized = normalizeDate(dateRange.start);
        const endNormalized = normalizeDate(dateRange.end);
        for (const item of filtered) {
          const itemDateNormalized = normalizeDate(new Date(item.timestamp));
          expect(itemDateNormalized.getTime()).toBeGreaterThanOrEqual(startNormalized.getTime());
          expect(itemDateNormalized.getTime()).toBeLessThanOrEqual(endNormalized.getTime());
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should include all items that fall within the date range', () => {
    fc.assert(
      fc.property(historyItemsArb, dateRangeArb, (items, dateRange) => {
        const filtered = filterByDateRange(items, dateRange);
        const startNormalized = normalizeDate(dateRange.start);
        const endNormalized = normalizeDate(dateRange.end);
        const expectedInRange = items.filter(item => {
          const itemDateNormalized = normalizeDate(new Date(item.timestamp));
          return itemDateNormalized >= startNormalized && itemDateNormalized <= endNormalized;
        });
        expect(filtered.length).toBe(expectedInRange.length);
      }),
      { numRuns: 100 }
    );
  });

  it('should return all items when no date range is specified', () => {
    fc.assert(
      fc.property(historyItemsArb, (items) => {
        const filtered = filterByDateRange(items, { start: null, end: null });
        expect(filtered.length).toBe(items.length);
      }),
      { numRuns: 100 }
    );
  });

  it('should filter correctly with only start date specified', () => {
    fc.assert(
      fc.property(historyItemsArb, validDateArb, (items, startDate) => {
        const filtered = filterByDateRange(items, { start: startDate, end: null });
        const startNormalized = normalizeDate(startDate);
        for (const item of filtered) {
          const itemDateNormalized = normalizeDate(new Date(item.timestamp));
          expect(itemDateNormalized.getTime()).toBeGreaterThanOrEqual(startNormalized.getTime());
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should filter correctly with only end date specified', () => {
    fc.assert(
      fc.property(historyItemsArb, validDateArb, (items, endDate) => {
        const filtered = filterByDateRange(items, { start: null, end: endDate });
        const endNormalized = normalizeDate(endDate);
        for (const item of filtered) {
          const itemDateNormalized = normalizeDate(new Date(item.timestamp));
          expect(itemDateNormalized.getTime()).toBeLessThanOrEqual(endNormalized.getTime());
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve item data integrity after filtering', () => {
    fc.assert(
      fc.property(historyItemsArb, dateRangeArb, (items, dateRange) => {
        const filtered = filterByDateRange(items, dateRange);
        for (const filteredItem of filtered) {
          const original = items.find(item => item.id === filteredItem.id);
          expect(original).toBeDefined();
          expect(filteredItem).toEqual(original);
        }
      }),
      { numRuns: 100 }
    );
  });
});
