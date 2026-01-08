import type { CSSProperties } from 'react';

export const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    padding: '2rem',
    textAlign: 'center',
  } as CSSProperties,

  icon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  } as CSSProperties,

  title: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginBottom: '0.5rem',
  } as CSSProperties,

  message: {
    fontSize: '1rem',
    color: 'var(--color-text-secondary)',
    marginBottom: '1.5rem',
    maxWidth: '500px',
  } as CSSProperties,

  errorDetails: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '1rem',
    marginBottom: '1.5rem',
    maxWidth: '600px',
    width: '100%',
    textAlign: 'left',
    overflow: 'auto',
  } as CSSProperties,

  errorText: {
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    color: 'var(--color-error)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  } as CSSProperties,

  suggestedAction: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary)',
    marginBottom: '1rem',
    fontStyle: 'italic',
  } as CSSProperties,

  retryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  } as CSSProperties,
};
