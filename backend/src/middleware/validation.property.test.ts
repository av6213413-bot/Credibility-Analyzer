import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { urlSchema, textSchema } from './validation';

/**
 * Feature: credibility-analyzer-backend, Property 5: URL Validation Rejection
 * Validates: Requirements 1.2, 6.2
 *
 * For any URL that does not start with "http://" or "https://",
 * the API SHALL return a 400 error with code "INVALID_URL".
 */
describe('URL Validation Property Tests', () => {
  // Generator for invalid URL prefixes (not http:// or https://)
  const invalidPrefixArbitrary = fc.oneof(
    fc.constant('ftp://'),
    fc.constant('file://'),
    fc.constant('mailto:'),
    fc.constant('ssh://'),
    fc.constant('ws://'),
    fc.constant('wss://'),
    fc.constant('data:'),
    fc.constant('javascript:'),
    fc.constant(''),
    fc.string({ minLength: 0, maxLength: 10, unit: fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', '1', '2', '3', ':', '/') })
  );

  // Generator for URL path/domain parts
  const urlPathArbitrary = fc.string({ minLength: 1, maxLength: 100, unit: 'grapheme-ascii' });

  it('Property 5: URLs not starting with http:// or https:// are rejected', () => {
    fc.assert(
      fc.property(invalidPrefixArbitrary, urlPathArbitrary, (prefix, path) => {
        // Skip if the generated string accidentally starts with http:// or https://
        const url = prefix + path;
        if (url.startsWith('http://') || url.startsWith('https://')) {
          return true; // Skip this case
        }

        const result = urlSchema.safeParse({ url });

        // Should fail validation
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('http');
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5: Valid http:// URLs are accepted', () => {
    fc.assert(
      fc.property(urlPathArbitrary, (path) => {
        const url = 'http://' + path;
        const result = urlSchema.safeParse({ url });

        expect(result.success).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5: Valid https:// URLs are accepted', () => {
    fc.assert(
      fc.property(urlPathArbitrary, (path) => {
        const url = 'https://' + path;
        const result = urlSchema.safeParse({ url });

        expect(result.success).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: credibility-analyzer-backend, Property 6: Empty Input Rejection
 * Validates: Requirements 2.2
 *
 * For any text input that is empty or contains only whitespace characters,
 * the API SHALL return a 400 error with code "EMPTY_INPUT".
 */
describe('Text Validation Property Tests - Empty Input', () => {
  // Generator for whitespace-only strings
  const whitespaceArbitrary = fc.stringOf(
    fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'),
    { minLength: 0, maxLength: 100 }
  );

  it('Property 6: Empty string is rejected', () => {
    const result = textSchema.safeParse({ text: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('empty');
    }
  });

  it('Property 6: Whitespace-only strings are rejected', () => {
    fc.assert(
      fc.property(whitespaceArbitrary, (text) => {
        const result = textSchema.safeParse({ text });

        // Should fail validation for empty or whitespace-only
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('empty');
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 6: Non-empty text with content is accepted', () => {
    // Generator for non-empty strings with at least one non-whitespace character
    const nonEmptyTextArbitrary = fc.string({ minLength: 1, maxLength: 1000 })
      .filter((s) => s.trim().length > 0);

    fc.assert(
      fc.property(nonEmptyTextArbitrary, (text) => {
        const result = textSchema.safeParse({ text });

        expect(result.success).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: credibility-analyzer-backend, Property 7: Text Length Validation
 * Validates: Requirements 2.3
 *
 * For any text input exceeding 10,000 characters,
 * the API SHALL return a 400 error with code "TEXT_TOO_LONG".
 */
describe('Text Validation Property Tests - Text Length', () => {
  const MAX_LENGTH = 10000;

  it('Property 7: Text exceeding 10,000 characters is rejected', () => {
    // Generator for strings longer than 10,000 characters
    const longTextArbitrary = fc.string({ minLength: MAX_LENGTH + 1, maxLength: MAX_LENGTH + 500 });

    fc.assert(
      fc.property(longTextArbitrary, (text) => {
        const result = textSchema.safeParse({ text });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('10,000');
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7: Text at exactly 10,000 characters is accepted', () => {
    // Generate text of exactly 10,000 characters
    const exactLengthText = 'a'.repeat(MAX_LENGTH);
    const result = textSchema.safeParse({ text: exactLengthText });

    expect(result.success).toBe(true);
  });

  it('Property 7: Text under 10,000 characters is accepted', () => {
    // Generator for valid-length non-empty strings
    const validLengthTextArbitrary = fc.string({ minLength: 1, maxLength: MAX_LENGTH })
      .filter((s) => s.trim().length > 0);

    fc.assert(
      fc.property(validLengthTextArbitrary, (text) => {
        const result = textSchema.safeParse({ text });

        expect(result.success).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
