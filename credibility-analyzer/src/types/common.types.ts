export interface UserPreferences {
  theme: 'light' | 'dark';
  defaultInputMode: 'url' | 'text';
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  defaultInputMode: 'url',
};

export interface RedFlag {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface PositiveIndicator {
  id: string;
  description: string;
  icon: string;
}

export interface Keyword {
  term: string;
  impact: 'positive' | 'negative';
  weight: number;
}

export interface AnalysisInput {
  type: 'url' | 'text';
  value: string;
}

export interface AnalysisResult {
  id: string;
  input: AnalysisInput;
  score: number;
  timestamp: Date;
  overview: string;
  redFlags: RedFlag[];
  positiveIndicators: PositiveIndicator[];
  keywords: Keyword[];
  metadata: {
    title?: string;
    thumbnail?: string;
    sourceUrl?: string;
  };
}

export interface HistoryItem {
  id: string;
  title: string;
  url?: string;
  score: number;
  timestamp: Date;
  thumbnail?: string;
}

export interface HistoryFilters {
  dateRange: { start: Date | null; end: Date | null };
  searchQuery: string;
  sortBy: 'date' | 'score';
  sortOrder: 'asc' | 'desc';
}

export type AnalysisStage = 'fetching' | 'processing' | 'analyzing' | 'generating';

export const STAGE_MESSAGES: Record<AnalysisStage, string> = {
  fetching: 'Fetching article...',
  processing: 'Processing text...',
  analyzing: 'Analyzing credibility...',
  generating: 'Generating report...',
};
