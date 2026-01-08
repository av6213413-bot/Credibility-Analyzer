/**
 * Feature: credibility-analyzer-frontend, Property 18: Theme Preference Persistence (Round-Trip)
 * Validates: Requirements 7.2, 8.2
 *
 * For any theme selection (light or dark), saving to storage then loading SHALL return the same theme value.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { storageService } from '@/services/storage';

describe('Property 18: Theme Preference Persistence (Round-Trip)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should persist and retrieve theme preference correctly (round-trip)', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant('light' as const), fc.constant('dark' as const)),
        (theme) => {
          // Save the theme preference
          const prefs = storageService.getPreferences();
          storageService.savePreferences({ ...prefs, theme });

          // Retrieve the theme preference
          const retrievedPrefs = storageService.getPreferences();

          // Round-trip: saved theme should equal retrieved theme
          expect(retrievedPrefs.theme).toBe(theme);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain theme preference across multiple saves', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(fc.constant('light' as const), fc.constant('dark' as const)), {
          minLength: 1,
          maxLength: 10,
        }),
        (themes) => {
          // Save multiple themes in sequence
          for (const theme of themes) {
            const prefs = storageService.getPreferences();
            storageService.savePreferences({ ...prefs, theme });
          }

          // The last saved theme should be the one retrieved
          const lastTheme = themes[themes.length - 1];
          const retrievedPrefs = storageService.getPreferences();

          expect(retrievedPrefs.theme).toBe(lastTheme);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve other preferences when updating theme', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant('light' as const), fc.constant('dark' as const)),
        fc.oneof(fc.constant('url' as const), fc.constant('text' as const)),
        (theme, defaultInputMode) => {
          // Save initial preferences
          storageService.savePreferences({ theme: 'light', defaultInputMode });

          // Update only the theme
          const prefs = storageService.getPreferences();
          storageService.savePreferences({ ...prefs, theme });

          // Retrieve and verify both values
          const retrievedPrefs = storageService.getPreferences();

          expect(retrievedPrefs.theme).toBe(theme);
          expect(retrievedPrefs.defaultInputMode).toBe(defaultInputMode);
        }
      ),
      { numRuns: 100 }
    );
  });
});
