/**
 * HistoryList Component
 * Displays a paginated list of history items with filtering and sorting
 * Requirements: 4.1, 4.3, 4.4, 4.5
 */

import { useState, useCallback, useMemo } from 'react';
import type { HistoryItem as HistoryItemType } from '@/types';
import { HistoryItem } from '../HistoryItem';
import { styles } from './HistoryList.styles';

export interface HistoryListProps {
  items: HistoryItemType[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDelete: (id: string) => void;
  onSelect?: (id: string) => void;
  isLoading?: boolean;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  items,
  totalItems,
  currentPage,
  totalPages,
  onPageChange,
  onDelete,
  onSelect,
  isLoading = false,
}) => {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // Generate page numbers to display
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  }, [currentPage, totalPages]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  const getButtonStyle = (buttonId: string, isDisabled: boolean, isActive: boolean = false) => {
    if (isDisabled) {
      return { ...styles.paginationButton, ...styles.paginationButtonDisabled };
    }
    if (isActive) {
      return { ...styles.paginationButton, ...styles.paginationButtonActive };
    }
    if (hoveredButton === buttonId) {
      return { ...styles.paginationButton, ...styles.paginationButtonHover };
    }
    return styles.paginationButton;
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={styles.container} data-testid="history-list">
        <div style={styles.loadingContainer} data-testid="history-list-loading">
          <div style={styles.loadingSpinner} />
          <span>Loading history...</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div style={styles.container} data-testid="history-list">
        <div style={styles.emptyState} data-testid="history-list-empty">
          <div style={styles.emptyIcon}>
            <EmptyIcon />
          </div>
          <h3 style={styles.emptyTitle}>No analyses found</h3>
          <p style={styles.emptyMessage}>
            {totalItems === 0
              ? 'Start analyzing content to build your history.'
              : 'No results match your current filters.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container} data-testid="history-list">
      {/* Results count */}
      <p style={styles.resultsCount} data-testid="history-list-count">
        Showing {items.length} of {totalItems} results
      </p>

      {/* List of items */}
      <div style={styles.listContainer} data-testid="history-list-items">
        {items.map((item) => (
          <HistoryItem
            key={item.id}
            item={item}
            onDelete={onDelete}
            onClick={onSelect}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={styles.paginationContainer} data-testid="history-list-pagination">
          {/* Previous button */}
          <button
            style={getButtonStyle('prev', currentPage === 1)}
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            onMouseEnter={() => setHoveredButton('prev')}
            onMouseLeave={() => setHoveredButton(null)}
            data-testid="pagination-prev"
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
          </button>

          {/* Page numbers */}
          <div style={styles.pageNumbers} data-testid="pagination-pages">
            {pageNumbers.map((page, index) => {
              if (page === 'ellipsis') {
                return (
                  <span key={`ellipsis-${index}`} style={styles.ellipsis}>
                    ...
                  </span>
                );
              }

              const isActive = page === currentPage;
              return (
                <button
                  key={page}
                  style={{
                    ...styles.pageNumber,
                    ...(isActive ? styles.pageNumberActive : {}),
                    ...(hoveredButton === `page-${page}` && !isActive
                      ? styles.paginationButtonHover
                      : {}),
                  }}
                  onClick={() => onPageChange(page)}
                  onMouseEnter={() => setHoveredButton(`page-${page}`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  data-testid={`pagination-page-${page}`}
                  aria-label={`Page ${page}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {page}
                </button>
              );
            })}
          </div>

          {/* Next button */}
          <button
            style={getButtonStyle('next', currentPage === totalPages)}
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            onMouseEnter={() => setHoveredButton('next')}
            onMouseLeave={() => setHoveredButton(null)}
            data-testid="pagination-next"
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </button>

          {/* Page info */}
          <span style={styles.paginationInfo} data-testid="pagination-info">
            Page {currentPage} of {totalPages}
          </span>
        </div>
      )}
    </div>
  );
};

// SVG Icons
const EmptyIcon: React.FC = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
);

const ChevronLeftIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
