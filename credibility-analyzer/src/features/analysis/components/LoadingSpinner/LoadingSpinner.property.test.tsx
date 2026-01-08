/**
 * Property Tests for LoadingSpinner Component
 * Feature: credibility-analyzer-frontend
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoadingSpinner } from './LoadingSpinner';
import type { AnalysisStage } from '../../../../types';
import { STAGE_MESSAGES } from '../../../../types';

// All valid analysis stages
const ALL_STAGES: AnalysisStage[] = ['fetching', 'processing', 'analyzing', 'generating'];

// Generator for valid analysis stages
const analysisStageArb = fc.constantFrom<AnalysisStage>(...ALL_STAGES);

/**
 * Feature: credibility-analyzer-frontend, Property 14: Loading Stage Messages
 * Validates: Requirements 5.2
 *
 * For any analysis stage, the Loading_Spinner SHALL display the corresponding
 * stage message from the predefined set.
 */
describe('Property 14: Loading Stage Messages', () => {
  it('should display the correct stage message for any analysis stage', () => {
    fc.assert(
      fc.property(analysisStageArb, (stage) => {
        const mockOnCancel = vi.fn();

        const { unmount } = render(
          <LoadingSpinner stage={stage} onCancel={mockOnCancel} />
        );

        // Get the stage message element
        const stageMessage = screen.getByTestId('stage-message');

        // Verify the message matches the expected message for this stage
        const expectedMessage = STAGE_MESSAGES[stage];
        expect(stageMessage.textContent).toBe(expectedMessage);

        unmount();
      }),
      { numRuns: 100 }
    );
  }, 30000);

  it('should display the spinner animation for any stage', () => {
    fc.assert(
      fc.property(analysisStageArb, (stage) => {
        const mockOnCancel = vi.fn();

        const { unmount } = render(
          <LoadingSpinner stage={stage} onCancel={mockOnCancel} />
        );

        // Verify the spinner animation element exists
        const spinner = screen.getByTestId('spinner-animation');
        expect(spinner).toBeDefined();

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it('should display the cancel button for any stage', () => {
    fc.assert(
      fc.property(analysisStageArb, (stage) => {
        const mockOnCancel = vi.fn();

        const { unmount } = render(
          <LoadingSpinner stage={stage} onCancel={mockOnCancel} />
        );

        // Verify the cancel button exists
        const cancelButton = screen.getByTestId('cancel-button');
        expect(cancelButton).toBeDefined();
        expect(cancelButton.textContent).toBe('Cancel');

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: credibility-analyzer-frontend, Property 15: Cancel Returns to Initial State
 * Validates: Requirements 5.3
 *
 * For any in-progress analysis, clicking cancel SHALL abort the request
 * and return the UI to the input-ready state.
 */
describe('Property 15: Cancel Returns to Initial State', () => {
  it('should call onCancel when cancel button is clicked for any stage', () => {
    fc.assert(
      fc.property(analysisStageArb, (stage) => {
        const mockOnCancel = vi.fn();

        const { unmount } = render(
          <LoadingSpinner stage={stage} onCancel={mockOnCancel} />
        );

        // Click the cancel button
        const cancelButton = screen.getByTestId('cancel-button');
        fireEvent.click(cancelButton);

        // Verify onCancel was called exactly once
        expect(mockOnCancel).toHaveBeenCalledTimes(1);

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});
