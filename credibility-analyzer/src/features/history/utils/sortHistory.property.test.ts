/**
 * Property Tests for History Sort Function
 * Feature: credibility-analyzer-frontend
 * Property 10: History Sort Correctness - Validates: Requirements 4.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sortHistory } from './sortHistory';
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

// Generator for sort criteria
const sortByArb = fc.constantFrom('date', 'score') as fc.Arbitrary<'date' | 'score'>;
const sortOrderArb = fc.constantFrom('asc', 'desc') as fc.Arbitrary<'asc' | 'desc'>;

/**
 * Helper to check if array is sorted by date
 */
const isSortedByDate = (items: HistoryItem[], order: 'asc' | 'desc'): boolean => {
  for (let i = 1; i < items.length; i++) {
    const prevTime = new Date(items[i - 1].timestamp).getTime();
    const currTime = new Date(items[i].timestamp).getTime();
    if (order === 'asc' && prevTime > currTime) return false;
    if (order === 'desc' && prevTime < currTime) return false;
  }
  return true;
};

/**
 * Helper to check if array is sorted by score
 */
const isSortedByScore = (items: HistoryItem[], order: 'asc' | 'desc'): boolean => {
  for (let i = 1; i < items.length; i++) {
    if (order === 'asc' && items[i - 1].score > items[i].score) return false;
    if (order === 'desc' && items[i - 1].score < items[i].score) return false;
  }
  return true;
};

describe('Property 10: History Sort Correctness', () => {
  /**
   * For any sort operation on history (by score or date, ascending or descending),
   * the resulting list SHALL be correctly ordered according to the sort criteria.
   * Validates: Requirements 4.4
   */

  it('should correctly sort items by date in ascending order', () => {
    fc.assert(
      fc.property(historyItemsArb, (items) => {
        const sorted = sortHistory(items, 'date', 'asc');
        expect(isSortedByDate(sorted, 'asc')).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly sort items by date in descending order', () => {
    fc.assert(
      fc.property(historyItemsArb, (items) => {
        const sorted = sortHistory(items, 'date', 'desc');
        expect(isSortedByDate(sorted, 'desc')).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly sort items by score in ascending order', () => {
    fc.assert(
      fc.property(historyItemsArb, (items) => {
        const sorted = sortHistory(items, 'score', 'asc');
        expect(isSortedByScore(sorted, 'asc')).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly sort items by score in descending order', () => {
    fc.assert(
      fc.property(historyItemsArb, (items) => {
        const sorted = sortHistory(items, 'score', 'desc');
        expect(isSortedByScore(sorted, 'desc')).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve all items after sorting (no items lost or duplicated)', () => {
    fc.assert(
      fc.property(historyItemsArb, sortByArb, sortOrderArb, (items, sortBy, sortOrder) => {
        const sorted = sortHistory(items, sortBy, sortOrder);
        expect(sorted.length).toBe(items.length);
        
        // Check all original items are present
        const sortedIds = new Set(sorted.map(item => item.id));
        const originalIds = new Set(items.map(item => item.id));
        expect(sortedIds).toEqual(originalIds);
      }),
      { numRuns: 100 }
    );
  });

  it('should not mutate the original array', () => {
    fc.assert(
      fc.property(historyItemsArb, sortByArb, sortOrderArb, (items, sortBy, sortOrder) => {
        const originalCopy = items.map(item => ({ ...item }));
        sortHistory(items, sortBy, sortOrder);
        
        // Original array should remain unchanged
        expect(items.length).toBe(originalCopy.length);
        for (let i = 0; i < items.length; i++) {
          expect(items[i].id).toBe(originalCopy[i].id);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve item data integrity after sorting', () => {
    fc.assert(
      fc.property(historyItemsArb, sortByArb, sortOrderArb, (items, sortBy, sortOrder) => {
        const sorted = sortHistory(items, sortBy, sortOrder);
        
        for (const sortedItem of sorted) {
          const original = items.find(item => item.id === sortedItem.id);
          expect(original).toBeDefined();
          expect(sortedItem).toEqual(original);
        }
      }),
      { numRuns: 100 }
    );
  });
});
