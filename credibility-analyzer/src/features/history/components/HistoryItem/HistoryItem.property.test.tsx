/**
 * Property Tests for HistoryItem Component
 * Feature: credibility-analyzer-frontend, Property 8: History Item Display Completeness
 * Validates: Requirements 4.2
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup, within } from '@testing-library/react';
import { HistoryItem } from './HistoryItem';
import type { HistoryItem as HistoryItemType } from '@/types';

afterEach(() => {
  cleanup();
});

// Valid date generator using integer timestamps to avoid NaN dates
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
}) as fc.Arbitrary<HistoryItemType>;

// Generator for history items with thumbnail
const historyItemWithThumbnailArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  url: fc.option(fc.webUrl(), { nil: undefined }),
  score: fc.integer({ min: 0, max: 100 }),
  timestamp: validDateArb,
  thumbnail: fc.webUrl(),
}) as fc.Arbitrary<HistoryItemType>;

// Generator for history items without thumbnail
const historyItemWithoutThumbnailArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  url: fc.option(fc.webUrl(), { nil: undefined }),
  score: fc.integer({ min: 0, max: 100 }),
  timestamp: validDateArb,
  thumbnail: fc.constant(undefined),
}) as fc.Arbitrary<HistoryItemType>;

describe('Property 8: History Item Display Completeness', () => {
  /**
   * For any history item, the rendered display SHALL include the title, score, date,
   * and thumbnail (if available).
   * Validates: Requirements 4.2
   */

  it('should display title for any history item', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(historyItemArb, (item) => {
        cleanup();
        const mockOnDelete = vi.fn();
        const { container, unmount } = render(
          <HistoryItem item={item} onDelete={mockOnDelete} />
        );

        const titleElement = within(container).getByTestId('history-item-title');
        expect(titleElement).toBeDefined();
        expect(titleElement.textContent).toBe(item.title);

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it('should display score for any history item', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(historyItemArb, (item) => {
        cleanup();
        const mockOnDelete = vi.fn();
        const { container, unmount } = render(
          <HistoryItem item={item} onDelete={mockOnDelete} />
        );

        const scoreElement = within(container).getByTestId('history-item-score');
        expect(scoreElement).toBeDefined();
        expect(scoreElement.textContent).toBe(item.score.toString());

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it('should display date for any history item', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(historyItemArb, (item) => {
        cleanup();
        const mockOnDelete = vi.fn();
        const { container, unmount } = render(
          <HistoryItem item={item} onDelete={mockOnDelete} />
        );

        const dateElement = within(container).getByTestId('history-item-date');
        expect(dateElement).toBeDefined();
        expect(dateElement.textContent).toBeTruthy();
        
        // Verify date contains year from timestamp
        const year = new Date(item.timestamp).getFullYear().toString();
        expect(dateElement.textContent).toContain(year);

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it('should display thumbnail when available', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(historyItemWithThumbnailArb, (item) => {
        cleanup();
        const mockOnDelete = vi.fn();
        const { container, unmount } = render(
          <HistoryItem item={item} onDelete={mockOnDelete} />
        );

        const thumbnailElement = within(container).getByTestId('history-item-thumbnail');
        expect(thumbnailElement).toBeDefined();
        expect(thumbnailElement.tagName.toLowerCase()).toBe('img');
        expect(thumbnailElement.getAttribute('src')).toBe(item.thumbnail);

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it('should display placeholder when thumbnail is not available', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(historyItemWithoutThumbnailArb, (item) => {
        cleanup();
        const mockOnDelete = vi.fn();
        const { container, unmount } = render(
          <HistoryItem item={item} onDelete={mockOnDelete} />
        );

        const placeholderElement = within(container).getByTestId('history-item-thumbnail-placeholder');
        expect(placeholderElement).toBeDefined();

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it('should display all required fields together for any history item', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(historyItemArb, (item) => {
        cleanup();
        const mockOnDelete = vi.fn();
        const { container, unmount } = render(
          <HistoryItem item={item} onDelete={mockOnDelete} />
        );

        // Verify all required elements are present
        const titleElement = within(container).getByTestId('history-item-title');
        const scoreElement = within(container).getByTestId('history-item-score');
        const dateElement = within(container).getByTestId('history-item-date');
        
        expect(titleElement).toBeDefined();
        expect(scoreElement).toBeDefined();
        expect(dateElement).toBeDefined();

        // Verify thumbnail or placeholder is present
        const hasThumbnail = container.querySelector('[data-testid="history-item-thumbnail"]');
        const hasPlaceholder = container.querySelector('[data-testid="history-item-thumbnail-placeholder"]');
        expect(hasThumbnail || hasPlaceholder).toBeTruthy();

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});
