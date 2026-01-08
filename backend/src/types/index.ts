// Request interfaces
export interface AnalyzeUrlRequest {
  url: string;
}

export interface AnalyzeTextRequest {
  text: string;
}

// Response interfaces
export interface AnalysisResult {
  id: string;
  input: {
    type: 'url' | 'text';
    value: string;
  };
  score: number;
  timestamp: string;
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

// Error interface
export interface APIError {
  code: string;
  message: string;
  suggestedAction?: string;
}
