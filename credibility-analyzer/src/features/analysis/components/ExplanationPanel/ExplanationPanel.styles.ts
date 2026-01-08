import type { CSSProperties } from 'react';

export const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--color-surface)',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border)',
    overflow: 'hidden',
    width: '100%',
    boxSizing: 'border-box',
  } as CSSProperties,

  tabList: {
    display: 'flex',
    borderBottom: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background)',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  } as CSSProperties,

  tab: {
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  } as CSSProperties,

  tabActive: {
    color: 'var(--color-primary)',
    borderBottomColor: 'var(--color-primary)',
  } as CSSProperties,

  tabContent: {
    padding: '1.5rem',
    minHeight: '200px',
  } as CSSProperties,

  // Mobile-friendly tab content
  tabContentMobile: {
    padding: '1rem',
  } as CSSProperties,

  overviewText: {
    fontSize: '1rem',
    lineHeight: 1.6,
    color: 'var(--color-text-primary)',
  } as CSSProperties,

  // Red Flags styles
  redFlagsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  } as CSSProperties,

  redFlagItem: {
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    overflow: 'hidden',
  } as CSSProperties,

  redFlagHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--color-background)',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    textAlign: 'left',
  } as CSSProperties,

  redFlagHeaderContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  } as CSSProperties,

  severityBadge: {
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    borderRadius: '0.25rem',
    textTransform: 'uppercase',
  } as CSSProperties,

  severityLow: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  } as CSSProperties,

  severityMedium: {
    backgroundColor: '#fed7aa',
    color: '#c2410c',
  } as CSSProperties,

  severityHigh: {
    backgroundColor: '#fecaca',
    color: '#b91c1c',
  } as CSSProperties,

  redFlagDescription: {
    fontSize: '0.875rem',
    color: 'var(--color-text-primary)',
  } as CSSProperties,

  expandIcon: {
    fontSize: '1rem',
    color: 'var(--color-text-secondary)',
    transition: 'transform 0.2s ease',
  } as CSSProperties,

  expandIconOpen: {
    transform: 'rotate(180deg)',
  } as CSSProperties,

  redFlagContent: {
    padding: '0.75rem 1rem',
    borderTop: '1px solid var(--color-border)',
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
  } as CSSProperties,

  // Positive Indicators styles
  positiveList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  } as CSSProperties,

  positiveItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--color-background)',
    borderRadius: '0.375rem',
    border: '1px solid var(--color-border)',
  } as CSSProperties,

  positiveIcon: {
    fontSize: '1.25rem',
    flexShrink: 0,
  } as CSSProperties,

  positiveDescription: {
    fontSize: '0.875rem',
    color: 'var(--color-text-primary)',
  } as CSSProperties,

  // Keywords styles
  keywordsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  } as CSSProperties,

  keywordItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.375rem 0.75rem',
    fontSize: '0.875rem',
    borderRadius: '9999px',
    fontWeight: 500,
  } as CSSProperties,

  keywordPositive: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  } as CSSProperties,

  keywordNegative: {
    backgroundColor: '#fecaca',
    color: '#b91c1c',
  } as CSSProperties,

  keywordWeight: {
    fontSize: '0.75rem',
    opacity: 0.8,
  } as CSSProperties,

  emptyState: {
    textAlign: 'center',
    padding: '2rem',
    color: 'var(--color-text-secondary)',
    fontSize: '0.875rem',
  } as CSSProperties,
};

// Severity color mapping
export const getSeverityStyle = (severity: 'low' | 'medium' | 'high'): CSSProperties => {
  switch (severity) {
    case 'low':
      return styles.severityLow;
    case 'medium':
      return styles.severityMedium;
    case 'high':
      return styles.severityHigh;
    default:
      return styles.severityLow;
  }
};
