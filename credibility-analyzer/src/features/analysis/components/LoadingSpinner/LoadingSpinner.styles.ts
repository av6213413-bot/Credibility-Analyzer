import type { CSSProperties } from 'react';

export const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5rem',
    padding: '3rem',
    backgroundColor: 'var(--color-surface)',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border)',
    minHeight: '200px',
  } as CSSProperties,

  spinnerWrapper: {
    position: 'relative',
    width: '64px',
    height: '64px',
  } as CSSProperties,

  spinner: {
    width: '64px',
    height: '64px',
    border: '4px solid var(--color-border)',
    borderTopColor: 'var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  } as CSSProperties,

  stageMessage: {
    fontSize: '1.125rem',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    textAlign: 'center',
  } as CSSProperties,

  cancelButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    border: '1px solid var(--color-border)',
    borderRadius: '0.25rem',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as CSSProperties,

  cancelButtonHover: {
    borderColor: 'var(--color-error)',
    color: 'var(--color-error)',
  } as CSSProperties,
};

// CSS keyframes for the spinner animation
export const spinnerKeyframes = `
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
`;
