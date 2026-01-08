import type { CSSProperties } from 'react';

export const styles = {
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    padding: '1rem',
    backgroundColor: 'var(--color-surface)',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border)',
    alignItems: 'flex-end',
  } as CSSProperties,

  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    minWidth: '150px',
    flex: '1 1 150px',
  } as CSSProperties,

  label: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  } as CSSProperties,

  input: {
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    border: '1px solid var(--color-border)',
    borderRadius: '0.25rem',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text-primary)',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    width: '100%',
    boxSizing: 'border-box',
  } as CSSProperties,

  inputFocus: {
    borderColor: 'var(--color-primary)',
  } as CSSProperties,

  searchInput: {
    flex: '2 1 200px',
    minWidth: '150px',
  } as CSSProperties,

  dateInput: {
    width: '100%',
    maxWidth: '140px',
  } as CSSProperties,

  select: {
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    border: '1px solid var(--color-border)',
    borderRadius: '0.25rem',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    minWidth: '100px',
    width: '100%',
    boxSizing: 'border-box',
  } as CSSProperties,

  dateRangeGroup: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  } as CSSProperties,

  dateSeparator: {
    color: 'var(--color-text-secondary)',
    fontSize: '0.875rem',
  } as CSSProperties,

  clearButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    border: '1px solid var(--color-border)',
    borderRadius: '0.25rem',
    backgroundColor: 'transparent',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginLeft: 'auto',
    whiteSpace: 'nowrap',
  } as CSSProperties,

  clearButtonHover: {
    backgroundColor: 'var(--color-surface-hover)',
    borderColor: 'var(--color-primary)',
  } as CSSProperties,
};
