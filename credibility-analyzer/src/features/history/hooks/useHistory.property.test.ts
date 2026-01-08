/**
 * Property Tests for useHistory Hook - Delete Consistency
 * Feature: credibility-analyzer-frontend, Property 12: History Delete Consistency
 * Validates: Requirements 4.6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { storageService } from '@/services/storage';
import type { AnalysisResult } from '@/types';

// Clear localStorage before and after each test
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// Create a simple analysis result generator
const createAnalysisResult = (index: number): AnalysisResult => ({
  id: `analysis-${index}-${Date.now()}`,
  input: {
    type: 'url',
    value: `https://example.com/article-${index}`,
  },
  score: Math.floor(Math.random() * 100),
  timestamp: new Date(2024, 0, index + 1),
  overview: `Overview for article ${index}`,
  redFlags: [],
  positiveIndicators: [],
  keywords: [],
  metadata: {
    title: `Article ${index}`,
    thumbnail: undefined,
    sourceUrl: `https://example.com/article-${index}`,
  },
});

// Generator for array of analysis results with specific length
const analysisResultsArb = fc.integer({ min: 1, max: 20 }).map(length => 
  Array.from({ length }, (_, i) => createAnalysisResult(i))
);

describe('Property 12: History Delete Consistency', () => {
  /**
   * For any history item with id X, after deletion, querying history
   * SHALL NOT return an item with id X.
   * Validates: Requirements 4.6
   */

  it('should not return deleted item when querying history', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        analysisResultsArb,
        fc.integer({ min: 0, max: 19 }),
        (items, deleteIndex) => {
          // Clear storage
          localStorage.clear();
          
          // Add all items to history
          items.forEach(item => {
            storageService.addToHistory(item);
          });
          
          // Get the item to delete (ensure valid index)
          const validIndex = deleteIndex % items.length;
          const itemToDelete = items[validIndex];
          
          // Verify item exists before deletion
          const historyBefore = storageService.getHistory();
          const existsBefore = historyBefore.some(h => h.id === itemToDelete.id);
          expect(existsBefore).toBe(true);
          
          // Delete the item
          storageService.deleteFromHistory(itemToDelete.id);
          
          // Verify item no longer exists after deletion
          const historyAfter = storageService.getHistory();
          const existsAfter = historyAfter.some(h => h.id === itemToDelete.id);
          expect(existsAfter).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve other items when deleting one item', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 15 }), // At least 2 items
        fc.integer({ min: 0, max: 14 }),
        (length, deleteIndex) => {
          // Clear storage
          localStorage.clear();
          
          // Create and add items
          const items = Array.from({ length }, (_, i) => createAnalysisResult(i));
          items.forEach(item => {
            storageService.addToHistory(item);
          });
          
          // Get the item to delete (ensure valid index)
          const validIndex = deleteIndex % items.length;
          const itemToDelete = items[validIndex];
          const otherItems = items.filter((_, i) => i !== validIndex);
          
          // Delete the item
          storageService.deleteFromHistory(itemToDelete.id);
          
          // Verify all other items still exist
          const historyAfter = storageService.getHistory();
          
          otherItems.forEach(otherItem => {
            const exists = historyAfter.some(h => h.id === otherItem.id);
            expect(exists).toBe(true);
          });
          
          // Verify count is correct
          expect(historyAfter.length).toBe(items.length - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle deleting non-existent item gracefully', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        analysisResultsArb,
        fc.uuid(),
        (items, nonExistentId) => {
          // Clear storage
          localStorage.clear();
          
          // Add all items to history
          items.forEach(item => {
            storageService.addToHistory(item);
          });
          
          const historyBefore = storageService.getHistory();
          const countBefore = historyBefore.length;
          
          // Try to delete non-existent item
          storageService.deleteFromHistory(nonExistentId);
          
          // Verify history is unchanged
          const historyAfter = storageService.getHistory();
          expect(historyAfter.length).toBe(countBefore);
          
          // Verify all original items still exist
          items.forEach(item => {
            const exists = historyAfter.some(h => h.id === item.id);
            expect(exists).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should result in empty history when deleting all items', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (length) => {
          // Clear storage
          localStorage.clear();
          
          // Create and add items
          const items = Array.from({ length }, (_, i) => createAnalysisResult(i));
          items.forEach(item => {
            storageService.addToHistory(item);
          });
          
          // Delete all items one by one
          items.forEach(item => {
            storageService.deleteFromHistory(item.id);
          });
          
          // Verify history is empty
          const historyAfter = storageService.getHistory();
          expect(historyAfter.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should persist deletion across storage reads', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        analysisResultsArb,
        fc.integer({ min: 0, max: 19 }),
        (items, deleteIndex) => {
          // Clear storage
          localStorage.clear();
          
          // Add all items to history
          items.forEach(item => {
            storageService.addToHistory(item);
          });
          
          // Get the item to delete (ensure valid index)
          const validIndex = deleteIndex % items.length;
          const itemToDelete = items[validIndex];
          
          // Delete the item
          storageService.deleteFromHistory(itemToDelete.id);
          
          // Read history multiple times to verify persistence
          const read1 = storageService.getHistory();
          const read2 = storageService.getHistory();
          const read3 = storageService.getHistory();
          
          // All reads should not contain the deleted item
          expect(read1.some(h => h.id === itemToDelete.id)).toBe(false);
          expect(read2.some(h => h.id === itemToDelete.id)).toBe(false);
          expect(read3.some(h => h.id === itemToDelete.id)).toBe(false);
          
          // All reads should have the same count
          expect(read1.length).toBe(items.length - 1);
          expect(read2.length).toBe(items.length - 1);
          expect(read3.length).toBe(items.length - 1);
        }
      ),
      { numRuns: 50 }
    );
  });
});
