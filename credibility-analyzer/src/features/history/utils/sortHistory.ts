/**
 * History Sort Utility Function
 * Requirements: 4.4
 */

import type { HistoryItem } from '@/types';

/**
 * Sort history items by specified criteria
 * Supports sorting by date or score, in ascending or descending order
 * Requirements: 4.4
 */
export const sortHistory = (
  items: HistoryItem[],
  sortBy: 'date' | 'score',
  sortOrder: 'asc' | 'desc'
): HistoryItem[] => {
  // Create a copy to avoid mutating the original array
  const sortedItems = [...items];

  sortedItems.sort((a, b) => {
    let comparison: number;

    if (sortBy === 'date') {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      comparison = dateA - dateB;
    } else {
      // sortBy === 'score'
      comparison = a.score - b.score;
    }

    // Apply sort order
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sortedItems;
};
