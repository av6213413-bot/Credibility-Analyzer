/**
 * Feature: credibility-analyzer-frontend, Property 20: Clear Cache Completeness
 * Validates: Requirements 8.3
 *
 * For any storage state, calling clearAll SHALL result in empty history and default preferences.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { storageService } from './storageService';
import { DEFAULT_PREFERENCES } from '@/types/common.types';
import type { AnalysisResult, UserPreferences, AnalysisInput } from '@/types';

// Arbitrary generators
const analysisInputArb: fc.Arbitrary<AnalysisInput> = fc.record({
  type: fc.oneof(fc.constant('url' as const), fc.constant('text' as const)),
  value: fc.string({ minLength: 1, maxLength: 100 }),
});

const analysisResultArb: fc.Arbitrary<AnalysisResult> = fc.record({
  id: fc.uuid(),
  input: analysisInputArb,
  score: fc.integer({ min: 0, max: 100 }),
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  overview: fc.string({ minLength: 1, maxLength: 200 }),
  redFlags: fc.array(
    fc.record({
      id: fc.uuid(),
      description: fc.string({ minLength: 1, maxLength: 100 }),
      severity: fc.oneof(
        fc.constant('low' as const),
        fc.constant('medium' as const),
        fc.constant('high' as const)
      ),
    }),
    { minLength: 0, maxLength: 3 }
  ),
  positiveIndicators: fc.array(
    fc.record({
      id: fc.uuid(),
      description: fc.string({ minLength: 1, maxLength: 100 }),
      icon: fc.string({ minLength: 1, maxLength: 20 }),
    }),
    { minLength: 0, maxLength: 3 }
  ),
  keywords: fc.array(
    fc.record({
      term: fc.string({ minLength: 1, maxLength: 30 }),
      impact: fc.oneof(fc.constant('positive' as const), fc.constant('negative' as const)),
      weight: fc.float({ min: 0, max: 1, noNaN: true }),
    }),
    { minLength: 0, maxLength: 5 }
  ),
  metadata: fc.record({
    title: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    thumbnail: fc.option(fc.webUrl(), { nil: undefined }),
    sourceUrl: fc.option(fc.webUrl(), { nil: undefined }),
  }),
});

const userPreferencesArb: fc.Arbitrary<UserPreferences> = fc.record({
  theme: fc.oneof(fc.constant('light' as const), fc.constant('dark' as const)),
  defaultInputMode: fc.oneof(fc.constant('url' as const), fc.constant('text' as const)),
});

describe('Property 20: Clear Cache Completeness', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should clear all history and reset preferences to defaults', () => {
    fc.assert(
      fc.property(
        fc.array(analysisResultArb, { minLength: 0, maxLength: 5 }),
        userPreferencesArb,
        (analysisResults, preferences) => {
          // Set up initial state with history and preferences
          storageService.savePreferences(preferences);
          for (const result of analysisResults) {
            storageService.addToHistory(result);
          }

          // Verify state was set (if there were items)
          if (analysisResults.length > 0) {
            expect(storageService.getHistory().length).toBeGreaterThan(0);
          }

          // Clear all
          storageService.clearAll();

          // Verify history is empty
          const history = storageService.getHistory();
          expect(history).toHaveLength(0);

          // Verify preferences are reset to defaults
          const retrievedPrefs = storageService.getPreferences();
          expect(retrievedPrefs).toEqual(DEFAULT_PREFERENCES);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should result in empty history regardless of initial history size', () => {
    fc.assert(
      fc.property(
        fc.array(analysisResultArb, { minLength: 1, maxLength: 10 }),
        (analysisResults) => {
          // Add all results to history
          for (const result of analysisResults) {
            storageService.addToHistory(result);
          }

          // Verify history has items
          expect(storageService.getHistory().length).toBe(analysisResults.length);

          // Clear all
          storageService.clearAll();

          // History should be empty
          expect(storageService.getHistory()).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reset any theme preference to default light theme', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant('light' as const), fc.constant('dark' as const)),
        (theme) => {
          // Set a theme preference
          storageService.savePreferences({ ...DEFAULT_PREFERENCES, theme });

          // Clear all
          storageService.clearAll();

          // Theme should be reset to default (light)
          const prefs = storageService.getPreferences();
          expect(prefs.theme).toBe(DEFAULT_PREFERENCES.theme);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reset any input mode preference to default url mode', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant('url' as const), fc.constant('text' as const)),
        (defaultInputMode) => {
          // Set an input mode preference
          storageService.savePreferences({ ...DEFAULT_PREFERENCES, defaultInputMode });

          // Clear all
          storageService.clearAll();

          // Input mode should be reset to default (url)
          const prefs = storageService.getPreferences();
          expect(prefs.defaultInputMode).toBe(DEFAULT_PREFERENCES.defaultInputMode);
        }
      ),
      { numRuns: 100 }
    );
  });
});
