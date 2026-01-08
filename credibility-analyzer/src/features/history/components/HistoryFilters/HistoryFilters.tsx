/**
 * HistoryFilters Component
 * Provides filtering and sorting controls for history list
 * Requirements: 4.3, 4.4, 4.5
 */

import { useState, useCallback } from 'react';
import type { HistoryFilters as HistoryFiltersType } from '@/types';
import { styles } from './HistoryFilters.styles';

export interface HistoryFiltersProps {
  filters: HistoryFiltersType;
  onFiltersChange: (filters: Partial<HistoryFiltersType>) => void;
  onClear: () => void;
}

export const HistoryFilters: React.FC<HistoryFiltersProps> = ({
  filters,
  onFiltersChange,
  onClear,
}) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [startDateFocused, setStartDateFocused] = useState(false);
  const [endDateFocused, setEndDateFocused] = useState(false);
  const [clearHovered, setClearHovered] = useState(false);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ searchQuery: e.target.value });
    },
    [onFiltersChange]
  );

  const handleStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      onFiltersChange({
        dateRange: {
          ...filters.dateRange,
          start: value ? new Date(value) : null,
        },
      });
    },
    [onFiltersChange, filters.dateRange]
  );

  const handleEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      onFiltersChange({
        dateRange: {
          ...filters.dateRange,
          end: value ? new Date(value) : null,
        },
      });
    },
    [onFiltersChange, filters.dateRange]
  );

  const handleSortByChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({ sortBy: e.target.value as 'date' | 'score' });
    },
    [onFiltersChange]
  );

  const handleSortOrderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({ sortOrder: e.target.value as 'asc' | 'desc' });
    },
    [onFiltersChange]
  );

  // Format date for input value
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  return (
    <div style={styles.container} data-testid="history-filters">
      {/* Search Input */}
      <div style={{ ...styles.filterGroup, ...styles.searchInput }}>
        <label style={styles.label} htmlFor="search-input">
          Search
        </label>
        <input
          id="search-input"
          type="text"
          placeholder="Search by title or URL..."
          value={filters.searchQuery}
          onChange={handleSearchChange}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            ...styles.input,
            ...(searchFocused ? styles.inputFocus : {}),
          }}
          data-testid="search-input"
        />
      </div>

      {/* Date Range */}
      <div style={styles.filterGroup}>
        <label style={styles.label}>Date Range</label>
        <div style={styles.dateRangeGroup}>
          <input
            type="date"
            value={formatDateForInput(filters.dateRange.start)}
            onChange={handleStartDateChange}
            onFocus={() => setStartDateFocused(true)}
            onBlur={() => setStartDateFocused(false)}
            style={{
              ...styles.input,
              ...styles.dateInput,
              ...(startDateFocused ? styles.inputFocus : {}),
            }}
            data-testid="start-date-input"
            aria-label="Start date"
          />
          <span style={styles.dateSeparator}>to</span>
          <input
            type="date"
            value={formatDateForInput(filters.dateRange.end)}
            onChange={handleEndDateChange}
            onFocus={() => setEndDateFocused(true)}
            onBlur={() => setEndDateFocused(false)}
            style={{
              ...styles.input,
              ...styles.dateInput,
              ...(endDateFocused ? styles.inputFocus : {}),
            }}
            data-testid="end-date-input"
            aria-label="End date"
          />
        </div>
      </div>

      {/* Sort By */}
      <div style={styles.filterGroup}>
        <label style={styles.label} htmlFor="sort-by-select">
          Sort By
        </label>
        <select
          id="sort-by-select"
          value={filters.sortBy}
          onChange={handleSortByChange}
          style={styles.select}
          data-testid="sort-by-select"
        >
          <option value="date">Date</option>
          <option value="score">Score</option>
        </select>
      </div>

      {/* Sort Order */}
      <div style={styles.filterGroup}>
        <label style={styles.label} htmlFor="sort-order-select">
          Order
        </label>
        <select
          id="sort-order-select"
          value={filters.sortOrder}
          onChange={handleSortOrderChange}
          style={styles.select}
          data-testid="sort-order-select"
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>

      {/* Clear Filters Button */}
      <button
        onClick={onClear}
        onMouseEnter={() => setClearHovered(true)}
        onMouseLeave={() => setClearHovered(false)}
        style={{
          ...styles.clearButton,
          ...(clearHovered ? styles.clearButtonHover : {}),
        }}
        data-testid="clear-filters-button"
      >
        Clear Filters
      </button>
    </div>
  );
};
