/**
 * useValidation hook for real-time input validation
 * Validates URL and text inputs according to requirements
 */

import { useCallback } from 'react';
import { VALIDATION_ERRORS } from '@/types/api.types';

export interface InputValidation {
  isValid: boolean;
  errorMessage: string | null;
}

// URL validation regex pattern - matches http:// or https:// followed by valid domain
const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

// Text input constraints
export const MAX_TEXT_LENGTH = 10000;

export interface UseValidationReturn {
  validate: (input: { type: 'url' | 'text'; value: string }) => InputValidation;
  validateUrl: (url: string) => InputValidation;
  validateText: (text: string) => InputValidation;
}

export const useValidation = (): UseValidationReturn => {
  const validateUrl = useCallback((url: string): InputValidation => {
    if (!url.trim()) {
      return { isValid: false, errorMessage: VALIDATION_ERRORS.EMPTY_INPUT };
    }
    if (!URL_PATTERN.test(url)) {
      return { isValid: false, errorMessage: VALIDATION_ERRORS.INVALID_URL };
    }
    return { isValid: true, errorMessage: null };
  }, []);

  const validateText = useCallback((text: string): InputValidation => {
    if (!text.trim()) {
      return { isValid: false, errorMessage: VALIDATION_ERRORS.EMPTY_INPUT };
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return { isValid: false, errorMessage: VALIDATION_ERRORS.TEXT_TOO_LONG };
    }
    return { isValid: true, errorMessage: null };
  }, []);

  const validate = useCallback(
    (input: { type: 'url' | 'text'; value: string }): InputValidation => {
      return input.type === 'url' ? validateUrl(input.value) : validateText(input.value);
    },
    [validateUrl, validateText]
  );

  return { validate, validateUrl, validateText };
};

// Export URL_PATTERN for testing
export { URL_PATTERN };
