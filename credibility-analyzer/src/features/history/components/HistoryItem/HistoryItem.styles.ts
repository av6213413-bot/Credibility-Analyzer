import type { CSSProperties } from 'react';

export const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    backgroundColor: 'var(--color-surface)',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border)',
    transition: 'all 0.2s ease',
    flexWrap: 'wrap',
  } as CSSProperties,

  containerHover: {
    borderColor: 'var(--color-primary)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  } as CSSProperties,

  thumbnail: {
    width: '64px',
    height: '64px',
    borderRadius: '0.25rem',
    objectFit: 'cover',
    backgroundColor: 'var(--color-border)',
    flexShrink: 0,
  } as CSSProperties,

  thumbnailPlaceholder: {
    width: '64px',
    height: '64px',
    borderRadius: '0.25rem',
    backgroundColor: 'var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: 'var(--color-text-secondary)',
  } as CSSProperties,

  // Mobile-friendly thumbnail
  thumbnailMobile: {
    width: '48px',
    height: '48px',
  } as CSSProperties,

  content: {
    flex: '1 1 200px',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  } as CSSProperties,

  title: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    margin: 0,
  } as CSSProperties,

  date: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary)',
    margin: 0,
  } as CSSProperties,

  scoreContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.5rem',
    minWidth: '60px',
    flexShrink: 0,
  } as CSSProperties,

  scoreValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    lineHeight: 1,
  } as CSSProperties,

  scoreLabel: {
    fontSize: '0.625rem',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  } as CSSProperties,

  deleteButton: {
    padding: '0.5rem',
    border: 'none',
    borderRadius: '0.25rem',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as CSSProperties,

  deleteButtonHover: {
    backgroundColor: 'var(--color-error-bg, #fef2f2)',
    color: 'var(--color-error, #ef4444)',
  } as CSSProperties,

  confirmOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as CSSProperties,

  confirmDialog: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '0.5rem',
    padding: '1.5rem',
    maxWidth: '400px',
    width: '90%',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  } as CSSProperties,

  confirmTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: '0 0 0.5rem 0',
  } as CSSProperties,

  confirmMessage: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary)',
    margin: '0 0 1.5rem 0',
  } as CSSProperties,

  confirmButtons: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'flex-end',
  } as CSSProperties,

  cancelButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    border: '1px solid var(--color-border)',
    borderRadius: '0.25rem',
    backgroundColor: 'transparent',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as CSSProperties,

  confirmDeleteButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    border: 'none',
    borderRadius: '0.25rem',
    backgroundColor: 'var(--color-error, #ef4444)',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as CSSProperties,
};

// Score color mapping
export const getScoreColor = (score: number): string => {
  if (score <= 40) return '#ef4444';
  if (score <= 70) return '#eab308';
  return '#22c55e';
};

export const getScoreLabel = (score: number): string => {
  if (score <= 40) return 'Low';
  if (score <= 70) return 'Moderate';
  return 'High';
};
