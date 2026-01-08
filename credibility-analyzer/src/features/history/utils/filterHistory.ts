/**
 * History Filter Utility Functions
 * Requirements: 4.3, 4.5
 */

import type { HistoryItem } from '@/types';

/**
 * Filter history items by date range
 * Returns items with timestamps within the specified range (inclusive)
 * Requirements: 4.3
 */
export const filterByDateRange = (
  items: HistoryItem[],
  dateRange: { start: Date | null; end: Date | null }
): HistoryItem[] => {
  const { start, end } = dateRange;

  // If no date range specified, return all items
  if (!start && !end) {
    return items;
  }

  return items.filter((item) => {
    const itemDate = new Date(item.timestamp);
    
    // Normalize to start of day for comparison
    const itemDateNormalized = new Date(
      itemDate.getFullYear(),
      itemDate.getMonth(),
      itemDate.getDate()
    );

    if (start && end) {
      const startNormalized = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate()
      );
      const endNormalized = new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate()
      );
      return itemDateNormalized >= startNormalized && itemDateNormalized <= endNormalized;
    }

    if (start) {
      const startNormalized = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate()
      );
      return itemDateNormalized >= startNormalized;
    }

    if (end) {
      const endNormalized = new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate()
      );
      return itemDateNormalized <= endNormalized;
    }

    return true;
  });
};

/**
 * Filter history items by search query
 * Matches against title and URL (case-insensitive)
 * Requirements: 4.5
 */
export const filterBySearch = (
  items: HistoryItem[],
  searchQuery: string
): HistoryItem[] => {
  const query = searchQuery.trim().toLowerCase();

  // If no search query, return all items
  if (!query) {
    return items;
  }

  return items.filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(query);
    const urlMatch = item.url ? item.url.toLowerCase().includes(query) : false;
    return titleMatch || urlMatch;
  });
};
