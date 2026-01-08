/**
 * Property Tests for ScoreDisplay Component
 * Feature: credibility-analyzer-frontend
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup, act, within } from '@testing-library/react';
import { ScoreDisplay } from './ScoreDisplay';
import { getScoreCategory, SCORE_CATEGORIES } from './ScoreDisplay.styles';

const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgb(${r}, ${g}, ${b})`;
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Property 4: Score Color Mapping', () => {
  const validScoreArb = fc.integer({ min: 0, max: 100 });
  const lowScoreArb = fc.integer({ min: 0, max: 40 });
  const moderateScoreArb = fc.integer({ min: 41, max: 70 });
  const highScoreArb = fc.integer({ min: 71, max: 100 });

  it('should return correct category for any valid score', () => {
    fc.assert(fc.property(validScoreArb, (score) => {
      const category = getScoreCategory(score);
      expect(score).toBeGreaterThanOrEqual(category.min);
      expect(score).toBeLessThanOrEqual(category.max);
      expect(SCORE_CATEGORIES).toContainEqual(category);
    }), { numRuns: 100 });
  });

  it('should display red and Low Credibility for scores 0-40', () => {
    fc.assert(fc.property(lowScoreArb, (score) => {
      const category = getScoreCategory(score);
      expect(category.color).toBe('#ef4444');
      expect(category.label).toBe('Low Credibility');
    }), { numRuns: 100 });
  });

  it('should display yellow and Moderate Credibility for scores 41-70', () => {
    fc.assert(fc.property(moderateScoreArb, (score) => {
      const category = getScoreCategory(score);
      expect(category.color).toBe('#eab308');
      expect(category.label).toBe('Moderate Credibility');
    }), { numRuns: 100 });
  });

  it('should display green and High Credibility for scores 71-100', () => {
    fc.assert(fc.property(highScoreArb, (score) => {
      const category = getScoreCategory(score);
      expect(category.color).toBe('#22c55e');
      expect(category.label).toBe('High Credibility');
    }), { numRuns: 100 });
  });

  it('should render ScoreDisplay with correct credibility label', { timeout: 30000 }, () => {
    fc.assert(fc.property(validScoreArb, (score) => {
      cleanup();
      const { container, unmount } = render(
        <ScoreDisplay score={score} timestamp={new Date('2024-01-15T10:30:00Z')} onShare={vi.fn()} onDownload={vi.fn()} />
      );
      act(() => { vi.advanceTimersByTime(1100); });
      const category = getScoreCategory(score);
      const credibilityLabel = within(container).getByTestId('credibility-label');
      expect(credibilityLabel.textContent).toBe(category.label);
      unmount();
    }), { numRuns: 100 });
  });

  it('should apply correct color to credibility label', { timeout: 30000 }, () => {
    fc.assert(fc.property(validScoreArb, (score) => {
      cleanup();
      const { container, unmount } = render(
        <ScoreDisplay score={score} timestamp={new Date('2024-01-15T10:30:00Z')} onShare={vi.fn()} onDownload={vi.fn()} />
      );
      act(() => { vi.advanceTimersByTime(1100); });
      const category = getScoreCategory(score);
      const credibilityLabel = within(container).getByTestId('credibility-label');
      expect(credibilityLabel.style.color).toBe(hexToRgb(category.color));
      unmount();
    }), { numRuns: 100 });
  });
});

describe('Property 5: Timestamp Display', () => {
  const validDateArb = fc.integer({ min: 1577836800000, max: 1893456000000 }).map(ts => new Date(ts));
  const validScoreArb = fc.integer({ min: 0, max: 100 });

  it('should display a timestamp for any analysis', { timeout: 30000 }, () => {
    fc.assert(fc.property(validScoreArb, validDateArb, (score, timestamp) => {
      cleanup();
      const { container, unmount } = render(
        <ScoreDisplay score={score} timestamp={timestamp} onShare={vi.fn()} onDownload={vi.fn()} />
      );
      act(() => { vi.advanceTimersByTime(1100); });
      const timestampElement = within(container).getByTestId('timestamp');
      expect(timestampElement).toBeDefined();
      expect(timestampElement.textContent).toBeTruthy();
      unmount();
    }), { numRuns: 100 });
  });

  it('should display timestamp with Analyzed on prefix', { timeout: 30000 }, () => {
    fc.assert(fc.property(validScoreArb, validDateArb, (score, timestamp) => {
      cleanup();
      const { container, unmount } = render(
        <ScoreDisplay score={score} timestamp={timestamp} onShare={vi.fn()} onDownload={vi.fn()} />
      );
      act(() => { vi.advanceTimersByTime(1100); });
      const timestampElement = within(container).getByTestId('timestamp');
      expect(timestampElement.textContent).toMatch(/^Analyzed on /);
      unmount();
    }), { numRuns: 100 });
  });

  it('should display timestamp containing correct date components', { timeout: 30000 }, () => {
    fc.assert(fc.property(validScoreArb, validDateArb, (score, timestamp) => {
      cleanup();
      const { container, unmount } = render(
        <ScoreDisplay score={score} timestamp={timestamp} onShare={vi.fn()} onDownload={vi.fn()} />
      );
      act(() => { vi.advanceTimersByTime(1100); });
      const timestampElement = within(container).getByTestId('timestamp');
      const displayedText = timestampElement.textContent || '';
      expect(displayedText).toContain(timestamp.getFullYear().toString());
      expect(displayedText).toContain(timestamp.getDate().toString());
      unmount();
    }), { numRuns: 100 });
  });
});
