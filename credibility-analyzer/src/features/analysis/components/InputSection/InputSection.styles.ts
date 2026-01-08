import type { CSSProperties } from 'react';

export const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1.5rem',
    backgroundColor: 'var(--color-surface)',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border)',
  } as CSSProperties,

  modeToggle: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  } as CSSProperties,

  modeButton: {
    padding: '0.5rem 1rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: '0.25rem',
    backgroundColor: 'transparent',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'all 0.2s ease',
  } as CSSProperties,

  modeButtonActive: {
    backgroundColor: 'var(--color-primary)',
    borderColor: 'var(--color-primary)',
    color: '#ffffff',
  } as CSSProperties,

  inputWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  } as CSSProperties,

  urlInput: {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: '0.25rem',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text-primary)',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
  } as CSSProperties,

  urlInputError: {
    borderColor: 'var(--color-error)',
  } as CSSProperties,

  textArea: {
    width: '100%',
    minHeight: '150px',
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: '0.25rem',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text-primary)',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
  } as CSSProperties,

  textAreaError: {
    borderColor: 'var(--color-error)',
  } as CSSProperties,

  characterCounter: {
    display: 'flex',
    justifyContent: 'flex-end',
    fontSize: '0.75rem',
    color: 'var(--color-text-secondary)',
  } as CSSProperties,

  characterCounterWarning: {
    color: 'var(--color-warning)',
  } as CSSProperties,

  characterCounterError: {
    color: 'var(--color-error)',
  } as CSSProperties,

  errorMessage: {
    color: 'var(--color-error)',
    fontSize: '0.875rem',
    marginTop: '0.25rem',
  } as CSSProperties,

  buttonGroup: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '0.5rem',
    flexWrap: 'wrap',
  } as CSSProperties,

  analyzeButton: {
    padding: '0.875rem 2rem',
    fontSize: '1.1rem',
    fontWeight: 900,
    border: 'none',
    borderRadius: '0.375rem',
    backgroundColor: 'var(--color-primary)',
    opacity: 0.7,
    color: '#000000',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flex: '1 1 auto',
    minWidth: '140px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  } as CSSProperties,

  analyzeButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    boxShadow: 'none',
  } as CSSProperties,

  clearButton: {
    padding: '0.875rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 600,
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: '0.375rem',
    backgroundColor: 'transparent',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flex: '0 1 auto',
    minWidth: '110px',
  } as CSSProperties,

  clearButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } as CSSProperties,
};
