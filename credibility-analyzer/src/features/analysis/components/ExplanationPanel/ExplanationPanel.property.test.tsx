/**
 * Property Tests for ExplanationPanel Component
 * Feature: credibility-analyzer-frontend
 * 
 * Property 6: Red Flag Severity Display
 * **Validates: Requirements 3.2**
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup, within } from '@testing-library/react';
import { RedFlagsTab } from './ExplanationPanel';
import type { RedFlag } from '../../../../types';

afterEach(() => {
  cleanup();
});

// Arbitrary for generating valid severity levels
const severityArb = fc.constantFrom<'low' | 'medium' | 'high'>('low', 'medium', 'high');

// Arbitrary for generating a valid RedFlag
const redFlagArb = fc.record({
  id: fc.uuid(),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  severity: severityArb,
});

// Arbitrary for generating an array of RedFlags
const redFlagsArrayArb = fc.array(redFlagArb, { minLength: 1, maxLength: 10 });

describe('Property 6: Red Flag Severity Display', () => {
  /**
   * Property 6: Red Flag Severity Display
   * *For any* red flag in an analysis result, the Explanation_Panel SHALL display
   * the red flag with its corresponding severity level indicator.
   * **Validates: Requirements 3.2**
   */

  it('should display severity badge for every red flag', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(redFlagsArrayArb, (redFlags) => {
        cleanup();
        const { container, unmount } = render(<RedFlagsTab redFlags={redFlags} />);

        // Verify each red flag has a severity badge displayed
        redFlags.forEach((flag) => {
          const flagElement = within(container).getByTestId(`red-flag-${flag.id}`);
          expect(flagElement).toBeDefined();

          const severityBadge = within(flagElement).getByTestId(`severity-badge-${flag.id}`);
          expect(severityBadge).toBeDefined();
          expect(severityBadge.getAttribute('data-severity')).toBe(flag.severity);
          expect(severityBadge.textContent?.toLowerCase()).toBe(flag.severity);
        });

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it('should display correct severity text for each severity level', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(severityArb, fc.uuid(), fc.string({ minLength: 1, maxLength: 100 }), (severity, id, description) => {
        cleanup();
        const redFlag: RedFlag = { id, description, severity };
        const { container, unmount } = render(<RedFlagsTab redFlags={[redFlag]} />);

        const severityBadge = within(container).getByTestId(`severity-badge-${id}`);
        expect(severityBadge.textContent?.toLowerCase()).toBe(severity);

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it('should display all red flags with their descriptions', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(redFlagsArrayArb, (redFlags) => {
        cleanup();
        const { container, unmount } = render(<RedFlagsTab redFlags={redFlags} />);

        // Verify each red flag description is displayed
        redFlags.forEach((flag) => {
          const flagElement = within(container).getByTestId(`red-flag-${flag.id}`);
          expect(flagElement.textContent).toContain(flag.description);
        });

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it('should render correct number of red flag items', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(redFlagsArrayArb, (redFlags) => {
        cleanup();
        const { container, unmount } = render(<RedFlagsTab redFlags={redFlags} />);

        // Count rendered red flag items
        const renderedFlags = container.querySelectorAll('[data-testid^="red-flag-"]');
        expect(renderedFlags.length).toBe(redFlags.length);

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it('should show empty state when no red flags', () => {
    const { container } = render(<RedFlagsTab redFlags={[]} />);
    expect(container.textContent).toContain('No red flags detected');
    cleanup();
  });
});
