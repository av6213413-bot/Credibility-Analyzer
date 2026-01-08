/**
 * Property Tests for InputSection Component
 * Feature: credibility-analyzer-frontend
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/shared/context';
import { InputSection } from './InputSection';
import { MAX_TEXT_LENGTH, URL_PATTERN } from '../../hooks';

// Helper to render with providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <ThemeProvider initialTheme="light">{ui}</ThemeProvider>
    </MemoryRouter>
  );
};

/**
 * Feature: credibility-analyzer-frontend, Property 1: Character Counter Accuracy
 * Validates: Requirements 1.2
 *
 * For any text input of length N where N ≤ 10,000, the character counter
 * SHALL display exactly (10,000 - N) as remaining characters.
 */
describe('Property 1: Character Counter Accuracy', () => {
  it('should display correct remaining characters for any text input length', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: MAX_TEXT_LENGTH }),
        (text) => {
          const mockOnAnalyze = () => {};

          const { unmount } = renderWithProviders(
            <InputSection onAnalyze={mockOnAnalyze} isLoading={false} defaultMode="text" />
          );

          // Get the text input and type the text
          const textInput = screen.getByTestId('text-input');
          fireEvent.change(textInput, { target: { value: text } });

          // Get the character counter
          const counter = screen.getByTestId('character-counter');

          // Calculate expected remaining characters
          const expectedRemaining = MAX_TEXT_LENGTH - text.length;

          // Verify the counter displays the correct value
          expect(counter.textContent).toBe(`${expectedRemaining} characters remaining`);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});

/**
 * Feature: credibility-analyzer-frontend, Property 2: URL Validation Consistency
 * Validates: Requirements 1.3
 *
 * For any string that does not match the URL pattern (starting with http:// or https://
 * followed by valid domain), the Input_Section SHALL display a validation error.
 */
describe('Property 2: URL Validation Consistency', () => {
  // Generator for invalid URLs (non-empty strings that don't match the URL pattern)
  const invalidUrlArb = fc.oneof(
    // Plain text without protocol
    fc.constantFrom('example.com', 'www.google.com', 'test', 'invalid-url'),
    // Strings with wrong protocol
    fc.constantFrom('ftp://example.com', 'mailto:test@test.com', 'file:///path'),
    // Incomplete URLs
    fc.constantFrom('http://', 'https://', 'http:/', 'https:'),
    // URLs with spaces in domain
    fc.constantFrom('https://example .com', 'http://test site.com'),
    // Random alphanumeric strings
    fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/)
  );

  it('should show validation error for invalid URLs', () => {
    fc.assert(
      fc.property(invalidUrlArb, (invalidUrl) => {
        // Skip if the string accidentally matches the URL pattern or is empty/whitespace
        if (URL_PATTERN.test(invalidUrl) || !invalidUrl.trim()) {
          return true;
        }

        const mockOnAnalyze = () => {};

        const { unmount } = renderWithProviders(
          <InputSection onAnalyze={mockOnAnalyze} isLoading={false} defaultMode="url" />
        );

        // Get the URL input and enter the invalid URL
        const urlInput = screen.getByTestId('url-input');
        fireEvent.change(urlInput, { target: { value: invalidUrl } });

        // Click analyze to trigger validation
        const analyzeButton = screen.getByTestId('analyze-button');
        fireEvent.click(analyzeButton);

        // Check that an error message is displayed
        const errorMessage = screen.queryByTestId('error-message');
        expect(errorMessage).not.toBeNull();

        unmount();
      }),
      { numRuns: 100 }
    );
  }, 30000);

  // Generator for valid URLs
  const validUrlArb = fc.webUrl();

  it('should not show validation error for valid URLs', () => {
    fc.assert(
      fc.property(validUrlArb, (validUrl) => {
        const mockOnAnalyze = () => {};

        const { unmount } = renderWithProviders(
          <InputSection onAnalyze={mockOnAnalyze} isLoading={false} defaultMode="url" />
        );

        // Get the URL input and enter the valid URL
        const urlInput = screen.getByTestId('url-input');
        fireEvent.change(urlInput, { target: { value: validUrl } });

        // Click analyze to trigger validation
        const analyzeButton = screen.getByTestId('analyze-button');
        fireEvent.click(analyzeButton);

        // Check that no error message is displayed
        const errorMessage = screen.queryByTestId('error-message');
        expect(errorMessage).toBeNull();

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: credibility-analyzer-frontend, Property 3: Input Clear Reset
 * Validates: Requirements 1.7
 *
 * For any input state (URL or text mode, with any content and validation messages),
 * clicking Clear SHALL return the component to its initial empty state with no validation messages.
 */
describe('Property 3: Input Clear Reset', () => {
  it('should reset URL input to initial state when Clear is clicked', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 50 }), (inputValue) => {
        const mockOnAnalyze = () => {};

        const { unmount } = renderWithProviders(
          <InputSection onAnalyze={mockOnAnalyze} isLoading={false} defaultMode="url" />
        );

        // Enter some value in URL input
        const urlInput = screen.getByTestId('url-input') as HTMLInputElement;
        fireEvent.change(urlInput, { target: { value: inputValue } });

        // Trigger validation by clicking analyze (to potentially show error)
        const analyzeButton = screen.getByTestId('analyze-button');
        fireEvent.click(analyzeButton);

        // Click Clear button
        const clearButton = screen.getByTestId('clear-button');
        fireEvent.click(clearButton);

        // Verify input is empty
        expect(urlInput.value).toBe('');

        // Verify no error message is displayed
        const errorMessage = screen.queryByTestId('error-message');
        expect(errorMessage).toBeNull();

        unmount();
      }),
      { numRuns: 100 }
    );
  }, 30000); // Increase timeout to 30 seconds

  it('should reset text input to initial state when Clear is clicked', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (inputValue) => {
          const mockOnAnalyze = () => {};

          const { unmount } = renderWithProviders(
            <InputSection onAnalyze={mockOnAnalyze} isLoading={false} defaultMode="text" />
          );

          // Enter some value in text input
          const textInput = screen.getByTestId('text-input') as HTMLTextAreaElement;
          fireEvent.change(textInput, { target: { value: inputValue } });

          // Click Clear button
          const clearButton = screen.getByTestId('clear-button');
          fireEvent.click(clearButton);

          // Verify input is empty
          expect(textInput.value).toBe('');

          // Verify character counter shows max remaining
          const counter = screen.getByTestId('character-counter');
          expect(counter.textContent).toBe(`${MAX_TEXT_LENGTH} characters remaining`);

          // Verify no error message is displayed
          const errorMessage = screen.queryByTestId('error-message');
          expect(errorMessage).toBeNull();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // Increase timeout to 30 seconds
});
