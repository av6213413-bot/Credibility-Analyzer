/**
 * useHistory Hook
 * Manages history state with filtering, sorting, and pagination
 * Requirements: 4.1, 4.3, 4.4, 4.5, 4.6
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { HistoryItem, HistoryFilters, AnalysisResult } from '@/types';
import { storageService } from '@/services/storage';
import { filterByDateRange, filterBySearch, sortHistory } from '../utils';
import { usePagination } from './usePagination';

const DEFAULT_FILTERS: HistoryFilters = {
  dateRange: { start: null, end: null },
  searchQuery: '',
  sortBy: 'date',
  sortOrder: 'desc',
};

export interface UseHistoryReturn {
  items: HistoryItem[];
  allItems: HistoryItem[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  filters: HistoryFilters;
  setFilters: (filters: Partial<HistoryFilters>) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  deleteItem: (id: string) => void;
  refreshHistory: () => void;
  isLoading: boolean;
}

/**
 * Convert AnalysisResult to HistoryItem
 */
const toHistoryItem = (result: AnalysisResult): HistoryItem => ({
  id: result.id,
  title: result.metadata.title || result.input.value.substring(0, 50),
  url: result.input.type === 'url' ? result.input.value : undefined,
  score: result.score,
  timestamp: result.timestamp,
  thumbnail: result.metadata.thumbnail,
});

export const useHistory = (): UseHistoryReturn => {
  const [allItems, setAllItems] = useState<HistoryItem[]>([]);
  const [filters, setFiltersState] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(true);

  // Load history from storage on mount
  useEffect(() => {
    const loadHistory = () => {
      setIsLoading(true);
      try {
        const history = storageService.getHistory();
        const historyItems = history.map(toHistoryItem);
        setAllItems(historyItems);
      } catch (error) {
        console.error('Failed to load history:', error);
        setAllItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, []);

  // Apply filters and sorting
  const filteredItems = useMemo(() => {
    let result = [...allItems];
    result = filterByDateRange(result, filters.dateRange);
    result = filterBySearch(result, filters.searchQuery);
    result = sortHistory(result, filters.sortBy, filters.sortOrder);
    return result;
  }, [allItems, filters]);

  // Pagination
  const pagination = usePagination({
    totalItems: filteredItems.length,
  });

  // Get paginated items
  const paginatedItems = useMemo(() => {
    return filteredItems.slice(pagination.startIndex, pagination.endIndex);
  }, [filteredItems, pagination.startIndex, pagination.endIndex]);

  // Update filters
  const setFilters = useCallback((newFilters: Partial<HistoryFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    // Reset to first page when filters change
    pagination.goToFirstPage();
  }, [pagination]);

  // Reset filters to defaults
  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    pagination.goToFirstPage();
  }, [pagination]);

  // Delete item
  const deleteItem = useCallback((id: string) => {
    storageService.deleteFromHistory(id);
    setAllItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Refresh history from storage
  const refreshHistory = useCallback(() => {
    setIsLoading(true);
    try {
      const history = storageService.getHistory();
      const historyItems = history.map(toHistoryItem);
      setAllItems(historyItems);
    } catch (error) {
      console.error('Failed to refresh history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    items: paginatedItems,
    allItems: filteredItems,
    totalItems: filteredItems.length,
    currentPage: pagination.currentPage,
    totalPages: pagination.totalPages,
    filters,
    setFilters,
    resetFilters,
    setPage: pagination.setPage,
    deleteItem,
    refreshHistory,
    isLoading,
  };
};
