import { format } from 'date-fns';
import type { AnalysisResult } from '@/types';

/**
 * CSV row interface matching design specification
 */
interface CSVRow {
  id: string;
  title: string;
  url: string;
  score: number;
  date: string;
  redFlagCount: number;
  positiveIndicatorCount: number;
}

/**
 * Escape CSV field value to handle special characters
 */
const escapeCSVField = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
};

/**
 * Convert AnalysisResult to CSVRow
 */
const toCSVRow = (result: AnalysisResult): CSVRow => ({
  id: result.id,
  title: result.metadata.title || result.input.value.substring(0, 50),
  url: result.input.type === 'url' ? result.input.value : '',
  score: result.score,
  date: format(new Date(result.timestamp), 'yyyy-MM-dd HH:mm:ss'),
  redFlagCount: result.redFlags.length,
  positiveIndicatorCount: result.positiveIndicators.length,
});

/**
 * Export history to CSV format
 * Requirements: 4.7
 * 
 * Generates a CSV file with the following columns:
 * - id: Unique identifier
 * - title: Article title or input excerpt
 * - url: Source URL (empty for text input)
 * - score: Credibility score (0-100)
 * - date: Analysis timestamp
 * - redFlagCount: Number of red flags
 * - positiveIndicatorCount: Number of positive indicators
 */
export const exportHistoryToCSV = (history: AnalysisResult[]): Blob => {
  const headers = ['id', 'title', 'url', 'score', 'date', 'redFlagCount', 'positiveIndicatorCount'];
  
  const rows = history.map(toCSVRow);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => [
      escapeCSVField(row.id),
      escapeCSVField(row.title),
      escapeCSVField(row.url),
      row.score.toString(),
      escapeCSVField(row.date),
      row.redFlagCount.toString(),
      row.positiveIndicatorCount.toString(),
    ].join(','))
  ].join('\n');
  
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
};

/**
 * Download CSV file for history export
 */
export const downloadHistoryCSV = (history: AnalysisResult[]): void => {
  const blob = exportHistoryToCSV(history);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'credibility-history-' + format(new Date(), 'yyyy-MM-dd') + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
