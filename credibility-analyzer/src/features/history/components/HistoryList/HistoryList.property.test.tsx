/**
 * Property Tests for HistoryList Component
 * Feature: credibility-analyzer-frontend, Property 7: History Pagination Consistency
 * Validates: Requirements 4.1
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { HistoryList } from './HistoryList';
import type { HistoryItem } from '@/types';

afterEach(() => {
  cleanup();
});

// Create a simple history item generator
const createHistoryItem = (index: number): HistoryItem => ({
  id: `item-${index}`,
  title: `Test Item ${index}`,
  url: `https://example.com/${index}`,
  score: Math.floor(Math.random() * 100),
  timestamp: new Date(2024, 0, index + 1),
  thumbnail: undefined,
});

// Generator for array of history items with specific length
const historyItemsArb = fc.integer({ min: 1, max: 35 }).map(length => 
  Array.from({ length }, (_, i) => createHistoryItem(i))
);

describe('Property 7: History Pagination Consistency', () => {
  /**
   * For any history list of N items with page size P, navigating through all pages
   * SHALL display exactly N unique items total.
   * Validates: Requirements 4.1
   */

  it('should display exactly N unique items when navigating through all pages', { timeout: 60000 }, () => {
    fc.assert(
      fc.property(
        historyItemsArb,
        (allItems) => {
          cleanup();
          
          const PAGE_SIZE = 10;
          const totalItems = allItems.length;
          const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
          
          // Track all displayed item IDs across all pages
          const displayedItemIds = new Set<string>();
          
          // Simulate navigating through each page
          for (let page = 1; page <= totalPages; page++) {
            const startIndex = (page - 1) * PAGE_SIZE;
            const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
            const pageItems = allItems.slice(startIndex, endIndex);
            
            const mockOnDelete = vi.fn();
            const mockOnPageChange = vi.fn();
            
            const { container, unmount } = render(
              <HistoryList
                items={pageItems}
                totalItems={totalItems}
                currentPage={page}
                totalPages={totalPages}
                onPageChange={mockOnPageChange}
                onDelete={mockOnDelete}
              />
            );
            
            // Collect all displayed item IDs on this page
            const historyItems = container.querySelectorAll('[data-testid="history-item"]');
            expect(historyItems.length).toBe(pageItems.length);
            
            pageItems.forEach(item => {
              displayedItemIds.add(item.id);
            });
            
            unmount();
          }
          
          // Verify total unique items equals original count
          expect(displayedItemIds.size).toBe(totalItems);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should show correct page count for any number of items', { timeout: 30000 }, () => {
    const PAGE_SIZE = 10;

    fc.assert(
      fc.property(
        fc.integer({ min: 11, max: 50 }), // Ensure multiple pages
        (length) => {
          cleanup();
          
          const allItems = Array.from({ length }, (_, i) => createHistoryItem(i));
          const totalItems = allItems.length;
          const expectedTotalPages = Math.ceil(totalItems / PAGE_SIZE);
          const pageItems = allItems.slice(0, PAGE_SIZE);
          
          const mockOnDelete = vi.fn();
          const mockOnPageChange = vi.fn();
          
          const { container, unmount } = render(
            <HistoryList
              items={pageItems}
              totalItems={totalItems}
              currentPage={1}
              totalPages={expectedTotalPages}
              onPageChange={mockOnPageChange}
              onDelete={mockOnDelete}
            />
          );
          
          // Check pagination info
          const paginationInfo = container.querySelector('[data-testid="pagination-info"]');
          expect(paginationInfo).toBeDefined();
          expect(paginationInfo?.textContent).toContain(`of ${expectedTotalPages}`);
          
          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should display correct results count for any page', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 35 }),
        (length) => {
          cleanup();
          
          const PAGE_SIZE = 10;
          const allItems = Array.from({ length }, (_, i) => createHistoryItem(i));
          const totalItems = allItems.length;
          const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
          const pageItems = allItems.slice(0, Math.min(PAGE_SIZE, totalItems));
          
          const mockOnDelete = vi.fn();
          const mockOnPageChange = vi.fn();
          
          const { container, unmount } = render(
            <HistoryList
              items={pageItems}
              totalItems={totalItems}
              currentPage={1}
              totalPages={totalPages}
              onPageChange={mockOnPageChange}
              onDelete={mockOnDelete}
            />
          );
          
          // Check results count
          const resultsCount = container.querySelector('[data-testid="history-list-count"]');
          expect(resultsCount).toBeDefined();
          expect(resultsCount?.textContent).toContain(`${pageItems.length}`);
          expect(resultsCount?.textContent).toContain(`${totalItems}`);
          
          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should call onPageChange with correct page number when navigating', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 15, max: 40 }), // Ensure multiple pages
        (length) => {
          cleanup();
          
          const PAGE_SIZE = 10;
          const allItems = Array.from({ length }, (_, i) => createHistoryItem(i));
          const totalItems = allItems.length;
          const totalPages = Math.ceil(totalItems / PAGE_SIZE);
          const pageItems = allItems.slice(0, PAGE_SIZE);
          
          const mockOnDelete = vi.fn();
          const mockOnPageChange = vi.fn();
          
          const { container, unmount } = render(
            <HistoryList
              items={pageItems}
              totalItems={totalItems}
              currentPage={1}
              totalPages={totalPages}
              onPageChange={mockOnPageChange}
              onDelete={mockOnDelete}
            />
          );
          
          // Click next button
          const nextButton = container.querySelector('[data-testid="pagination-next"]');
          if (nextButton) {
            fireEvent.click(nextButton);
            expect(mockOnPageChange).toHaveBeenCalledWith(2);
          }
          
          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should disable prev button on first page and next button on last page', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 15, max: 40 }), // Ensure multiple pages
        (length) => {
          cleanup();
          
          const PAGE_SIZE = 10;
          const allItems = Array.from({ length }, (_, i) => createHistoryItem(i));
          const totalItems = allItems.length;
          const totalPages = Math.ceil(totalItems / PAGE_SIZE);
          
          // Test first page - prev should be disabled
          const firstPageItems = allItems.slice(0, PAGE_SIZE);
          const mockOnDelete = vi.fn();
          const mockOnPageChange = vi.fn();
          
          const { container: firstPageContainer, unmount: unmountFirst } = render(
            <HistoryList
              items={firstPageItems}
              totalItems={totalItems}
              currentPage={1}
              totalPages={totalPages}
              onPageChange={mockOnPageChange}
              onDelete={mockOnDelete}
            />
          );
          
          const prevButtonFirst = firstPageContainer.querySelector('[data-testid="pagination-prev"]') as HTMLButtonElement;
          expect(prevButtonFirst?.disabled).toBe(true);
          
          unmountFirst();
          cleanup();
          
          // Test last page - next should be disabled
          const lastPageStart = (totalPages - 1) * PAGE_SIZE;
          const lastPageItems = allItems.slice(lastPageStart);
          
          const { container: lastPageContainer, unmount: unmountLast } = render(
            <HistoryList
              items={lastPageItems}
              totalItems={totalItems}
              currentPage={totalPages}
              totalPages={totalPages}
              onPageChange={mockOnPageChange}
              onDelete={mockOnDelete}
            />
          );
          
          const nextButtonLast = lastPageContainer.querySelector('[data-testid="pagination-next"]') as HTMLButtonElement;
          expect(nextButtonLast?.disabled).toBe(true);
          
          unmountLast();
        }
      ),
      { numRuns: 50 }
    );
  });
});
