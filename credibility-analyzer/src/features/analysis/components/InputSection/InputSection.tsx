/**
 * InputSection Component
 * Handles URL and text input modes with real-time validation
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */

import { useState, useCallback, useEffect } from 'react';
import { useValidation, MAX_TEXT_LENGTH } from '../../hooks';
import type { AnalysisInput } from '@/types';
import { styles } from './InputSection.styles';
import './InputSection.css';

export interface InputSectionProps {
  onAnalyze: (input: AnalysisInput) => void;
  isLoading: boolean;
  defaultMode?: 'url' | 'text';
}

export const InputSection: React.FC<InputSectionProps> = ({
  onAnalyze,
  isLoading,
  defaultMode = 'url',
}) => {
  const [mode, setMode] = useState<'url' | 'text'>(defaultMode);
  const [value, setValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const { validateUrl, validateText } = useValidation();

  // Real-time validation on value change
  useEffect(() => {
    if (!hasInteracted) return;

    const validation = mode === 'url' ? validateUrl(value) : validateText(value);
    setErrorMessage(validation.errorMessage);
  }, [value, mode, hasInteracted, validateUrl, validateText]);

  const handleModeChange = useCallback((newMode: 'url' | 'text') => {
    setMode(newMode);
    setValue('');
    setErrorMessage(null);
    setHasInteracted(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value;

      // For text mode, prevent input beyond max length (Requirement 1.4)
      if (mode === 'text' && newValue.length > MAX_TEXT_LENGTH) {
        return;
      }

      setValue(newValue);
      if (!hasInteracted) {
        setHasInteracted(true);
      }
    },
    [mode, hasInteracted]
  );

  const handleAnalyze = useCallback(() => {
    const validation = mode === 'url' ? validateUrl(value) : validateText(value);

    if (!validation.isValid) {
      setErrorMessage(validation.errorMessage);
      setHasInteracted(true);
      return;
    }

    onAnalyze({ type: mode, value });
  }, [mode, value, validateUrl, validateText, onAnalyze]);

  const handleClear = useCallback(() => {
    setValue('');
    setErrorMessage(null);
    setHasInteracted(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && mode === 'url' && !isLoading) {
        handleAnalyze();
      }
    },
    [mode, isLoading, handleAnalyze]
  );

  // Calculate remaining characters for text mode
  const remainingChars = MAX_TEXT_LENGTH - value.length;
  const isNearLimit = remainingChars <= 500;
  const isAtLimit = remainingChars <= 0;

  // Determine if analyze button should be disabled
  const isAnalyzeDisabled = isLoading || !value.trim();

  return (
    <div style={styles.container} data-testid="input-section">
      {/* Mode Toggle */}
      <div style={styles.modeToggle} role="tablist" aria-label="Input mode">
        <button
          style={{
            ...styles.modeButton,
            ...(mode === 'url' ? styles.modeButtonActive : {}),
          }}
          onClick={() => handleModeChange('url')}
          role="tab"
          aria-selected={mode === 'url'}
          aria-controls="url-input-panel"
          data-testid="url-mode-button"
        >
          URL
        </button>
        <button
          style={{
            ...styles.modeButton,
            ...(mode === 'text' ? styles.modeButtonActive : {}),
          }}
          onClick={() => handleModeChange('text')}
          role="tab"
          aria-selected={mode === 'text'}
          aria-controls="text-input-panel"
          data-testid="text-mode-button"
        >
          Text
        </button>
      </div>

      {/* Input Area */}
      <div style={styles.inputWrapper}>
        {mode === 'url' ? (
          <div id="url-input-panel" role="tabpanel">
            <input
              type="url"
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Enter URL to analyze (e.g., https://example.com/article)"
              style={{
                ...styles.urlInput,
                ...(errorMessage ? styles.urlInputError : {}),
              }}
              disabled={isLoading}
              aria-invalid={!!errorMessage}
              aria-describedby={errorMessage ? 'input-error' : undefined}
              data-testid="url-input"
            />
          </div>
        ) : (
          <div id="text-input-panel" role="tabpanel">
            <textarea
              value={value}
              onChange={handleInputChange}
              placeholder="Paste or type text to analyze..."
              style={{
                ...styles.textArea,
                ...(errorMessage ? styles.textAreaError : {}),
              }}
              disabled={isLoading}
              aria-invalid={!!errorMessage}
              aria-describedby={errorMessage ? 'input-error' : 'char-counter'}
              data-testid="text-input"
            />
            <div
              id="char-counter"
              style={{
                ...styles.characterCounter,
                ...(isAtLimit
                  ? styles.characterCounterError
                  : isNearLimit
                    ? styles.characterCounterWarning
                    : {}),
              }}
              data-testid="character-counter"
              aria-live="polite"
            >
              {remainingChars} characters remaining
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div
            id="input-error"
            style={styles.errorMessage}
            role="alert"
            data-testid="error-message"
          >
            {errorMessage}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={styles.buttonGroup}>
        <button
          style={{
            ...styles.analyzeButton,
            ...(isAnalyzeDisabled ? styles.analyzeButtonDisabled : {}),
          }}
          onClick={handleAnalyze}
          disabled={isAnalyzeDisabled}
          data-testid="analyze-button"
          title={isAnalyzeDisabled ? 'Enter a URL or text to analyze' : 'Click to analyze'}
        >
          {isLoading ? 'Analyzing...' : 'START ANALYSIS'}
        </button>
        <button
          style={{
            ...styles.clearButton,
            ...(isLoading ? styles.clearButtonDisabled : {}),
          }}
          onClick={handleClear}
          disabled={isLoading}
          data-testid="clear-button"
        >
          Clear
        </button>
      </div>
    </div>
  );
};
