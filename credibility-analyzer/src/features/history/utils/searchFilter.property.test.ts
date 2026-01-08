/**
 * Property Tests for Search Filter Function
 * Feature: credibility-analyzer-frontend
 * Property 11: Search Filter Correctness - Validates: Requirements 4.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterBySearch } from './filterHistory';
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

// Generator for non-empty search strings (alphanumeric to ensure valid search terms)
const alphanumericChar = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')
);
const searchQueryArb: fc.Arbitrary<string> = fc.array(alphanumericChar, { minLength: 1, maxLength: 20 })
  .map(chars => chars.join(''));

// Generator for whitespace-only strings
const whitespaceArb: fc.Arbitrary<string> = fc.array(fc.constant(' '), { minLength: 1, maxLength: 10 })
  .map(arr => arr.join(''));

describe('Property 11: Search Filter Correctness', () => {
  /**
   * For any search query Q applied to history, all returned items SHALL
   * contain Q in their title or URL (case-insensitive).
   * Feature: credibility-analyzer-frontend, Property 11: Search Filter Correctness
   * Validates: Requirements 4.5
   */

  it('should return only items containing the search query in title or URL (case-insensitive)', () => {
    fc.assert(
      fc.property(historyItemsArb, searchQueryArb, (items: HistoryItem[], query: string) => {
        const filtered = filterBySearch(items, query);
        const queryLower = query.toLowerCase();
        
        for (const item of filtered) {
          const titleMatch = item.title.toLowerCase().includes(queryLower);
          const urlMatch = item.url ? item.url.toLowerCase().includes(queryLower) : false;
          expect(titleMatch || urlMatch).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should include all items that match the search query', () => {
    fc.assert(
      fc.property(historyItemsArb, searchQueryArb, (items: HistoryItem[], query: string) => {
        const filtered = filterBySearch(items, query);
        const queryLower = query.toLowerCase();
        
        const expectedMatches = items.filter(item => {
          const titleMatch = item.title.toLowerCase().includes(queryLower);
          const urlMatch = item.url ? item.url.toLowerCase().includes(queryLower) : false;
          return titleMatch || urlMatch;
        });
        
        expect(filtered.length).toBe(expectedMatches.length);
      }),
      { numRuns: 100 }
    );
  });

  it('should return all items when search query is empty', () => {
    fc.assert(
      fc.property(historyItemsArb, (items: HistoryItem[]) => {
        const filtered = filterBySearch(items, '');
        expect(filtered.length).toBe(items.length);
      }),
      { numRuns: 100 }
    );
  });

  it('should return all items when search query is only whitespace', () => {
    fc.assert(
      fc.property(historyItemsArb, whitespaceArb, (items: HistoryItem[], whitespace: string) => {
        const filtered = filterBySearch(items, whitespace);
        expect(filtered.length).toBe(items.length);
      }),
      { numRuns: 100 }
    );
  });

  it('should be case-insensitive when matching', () => {
    fc.assert(
      fc.property(historyItemsArb, searchQueryArb, (items: HistoryItem[], query: string) => {
        const filteredLower = filterBySearch(items, query.toLowerCase());
        const filteredUpper = filterBySearch(items, query.toUpperCase());
        const filteredMixed = filterBySearch(items, query);
        
        expect(filteredLower.length).toBe(filteredUpper.length);
        expect(filteredLower.length).toBe(filteredMixed.length);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve item data integrity after filtering', () => {
    fc.assert(
      fc.property(historyItemsArb, searchQueryArb, (items: HistoryItem[], query: string) => {
        const filtered = filterBySearch(items, query);
        
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
