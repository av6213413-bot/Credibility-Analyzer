/**
 * Feature: credibility-analyzer-frontend, Property 17: Invalid Route Handling
 * Validates: Requirements 7.4
 *
 * For any route not matching defined paths (/, /analysis, /history), the application SHALL render the 404 page.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { AppRoutes } from './AppRoutes';
import { ROUTES } from '@/constants';

// Valid routes that should NOT show 404
const VALID_ROUTES = [ROUTES.HOME, ROUTES.ANALYSIS, ROUTES.HISTORY];

// Generator for valid URL path segments (alphanumeric and hyphens only)
const validPathSegmentArb = fc
  .stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/)
  .filter((s) => s.length >= 1 && s.length <= 20);

// Generator for invalid routes (routes that don't match valid paths)
const invalidRouteArb = validPathSegmentArb
  .filter((s) => {
    const route = `/${s}`;
    // Must not be a valid route
    return !VALID_ROUTES.includes(route as (typeof VALID_ROUTES)[number]);
  })
  .map((s) => `/${s}`);

describe('Property 17: Invalid Route Handling', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render 404 page for any invalid route', () => {
    fc.assert(
      fc.property(invalidRouteArb, (invalidRoute) => {
        const { unmount } = renderWithProviders(<AppRoutes />, {
          initialRoute: invalidRoute,
          withAnalysisProvider: true,
        });

        // The 404 page should be rendered
        expect(screen.getByText('404')).toBeInTheDocument();
        expect(screen.getByText('Page Not Found')).toBeInTheDocument();

        // Navigation options should be available
        expect(screen.getByText('Go Home')).toBeInTheDocument();
        expect(screen.getByText('Start Analysis')).toBeInTheDocument();

        unmount();
      }),
      { numRuns: 100 }
    );
  }, 30000);

  it('should NOT render 404 page for valid routes', () => {
    // Test each valid route
    for (const validRoute of VALID_ROUTES) {
      const { unmount } = renderWithProviders(<AppRoutes />, {
        initialRoute: validRoute,
        withAnalysisProvider: true,
      });

      // The 404 page should NOT be rendered
      expect(screen.queryByText('404')).not.toBeInTheDocument();
      expect(screen.queryByText('Page Not Found')).not.toBeInTheDocument();

      unmount();
    }
  });

  it('should render 404 for routes with multiple path segments', () => {
    fc.assert(
      fc.property(
        fc.array(validPathSegmentArb, { minLength: 1, maxLength: 3 }),
        (segments) => {
          // Filter out segments that would create valid routes
          const filteredSegments = segments.filter(
            (s) => !['analysis', 'history'].includes(s.toLowerCase())
          );

          if (filteredSegments.length === 0) return; // Skip if all segments were filtered

          const invalidRoute = '/' + filteredSegments.join('/');

          // Skip if this accidentally creates a valid route
          if (VALID_ROUTES.includes(invalidRoute as (typeof VALID_ROUTES)[number])) return;

          const { unmount } = renderWithProviders(<AppRoutes />, {
            initialRoute: invalidRoute,
            withAnalysisProvider: true,
          });

          expect(screen.getByText('404')).toBeInTheDocument();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
