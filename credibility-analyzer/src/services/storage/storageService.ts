import type { UserPreferences, AnalysisResult } from '@/types';
import { DEFAULT_PREFERENCES } from '@/types/common.types';
import { STORAGE_KEYS } from './storageKeys';

export interface StorageService {
  getPreferences(): UserPreferences;
  savePreferences(prefs: UserPreferences): void;
  getHistory(): AnalysisResult[];
  addToHistory(result: AnalysisResult): void;
  deleteFromHistory(id: string): void;
  clearHistory(): void;
  clearAll(): void;
}

const getPreferences = (): UserPreferences => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (stored) {
      return JSON.parse(stored) as UserPreferences;
    }
  } catch {
    // Return defaults on error
  }
  return DEFAULT_PREFERENCES;
};

const savePreferences = (prefs: UserPreferences): void => {
  localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
};

const getHistory = (): AnalysisResult[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (stored) {
      const parsed = JSON.parse(stored) as AnalysisResult[];
      return parsed.map((item) => ({
        ...item,
        timestamp: new Date(item.timestamp),
      }));
    }
  } catch {
    // Return empty array on error
  }
  return [];
};

const addToHistory = (result: AnalysisResult): void => {
  const history = getHistory();
  history.unshift(result);
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
};

const deleteFromHistory = (id: string): void => {
  const history = getHistory();
  const filtered = history.filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(filtered));
};

const clearHistory = (): void => {
  localStorage.removeItem(STORAGE_KEYS.HISTORY);
};

const clearAll = (): void => {
  localStorage.removeItem(STORAGE_KEYS.PREFERENCES);
  localStorage.removeItem(STORAGE_KEYS.HISTORY);
};

export const storageService: StorageService = {
  getPreferences,
  savePreferences,
  getHistory,
  addToHistory,
  deleteFromHistory,
  clearHistory,
  clearAll,
};
