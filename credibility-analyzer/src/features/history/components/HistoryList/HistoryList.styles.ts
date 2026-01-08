/**
 * HistoryList Component Styles
 * Requirements: 4.1
 */

import type { CSSProperties } from 'react';

export const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
  },

  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px dashed #d1d5db',
  },

  emptyIcon: {
    marginBottom: '16px',
    color: '#9ca3af',
  },

  emptyTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#374151',
    margin: '0 0 8px 0',
  },

  emptyMessage: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },

  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    color: '#6b7280',
  },

  loadingSpinner: {
    width: '24px',
    height: '24px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginRight: '12px',
  },

  paginationContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px 0',
    borderTop: '1px solid #e5e7eb',
    marginTop: '8px',
  },

  paginationInfo: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 16px',
  },

  paginationButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontSize: '14px',
    fontWeight: 500,
  },

  paginationButtonHover: {
    backgroundColor: '#f3f4f6',
    borderColor: '#9ca3af',
  },

  paginationButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    backgroundColor: '#f9fafb',
  },

  paginationButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
    color: '#ffffff',
  },

  pageNumbers: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },

  pageNumber: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '36px',
    height: '36px',
    padding: '0 8px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontSize: '14px',
    fontWeight: 500,
  },

  pageNumberActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
    color: '#ffffff',
  },

  ellipsis: {
    padding: '0 8px',
    color: '#6b7280',
  },

  resultsCount: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '8px',
  },
};
