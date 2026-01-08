/**
 * AnalysisPage Component
 * Integrates InputSection, LoadingSpinner, ScoreDisplay, and ExplanationPanel
 * Handles state transitions between input, loading, and results
 * Requirements: 1.1-1.7, 2.1-2.6, 3.1-3.5, 5.1-5.3, 8.1
 */

import { useCallback } from 'react';
import { useAnalysis } from '../context';
import {
  InputSection,
  LoadingSpinner,
  ScoreDisplay,
  ExplanationPanel,
} from '../components';
import { downloadAnalysisPDF } from '@/services/export';
import type { AnalysisInput } from '@/types';

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '24px',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '16px',
    color: 'var(--text-secondary)',
  },
  content: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  resultsSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  errorContainer: {
    padding: '24px',
    backgroundColor: 'var(--error-bg, #fef2f2)',
    borderRadius: '8px',
    border: '1px solid var(--error-border, #fecaca)',
  },
  errorTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--error-text, #dc2626)',
    marginBottom: '8px',
  },
  errorMessage: {
    fontSize: '14px',
    color: 'var(--error-text, #dc2626)',
    marginBottom: '16px',
  },
  errorAction: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '16px',
  },
  retryButton: {
    padding: '10px 20px',
    backgroundColor: 'var(--primary-color, #3b82f6)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  newAnalysisButton: {
    padding: '12px 24px',
    backgroundColor: 'var(--color-primary)',
    color: '#000000',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--color-primary)',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '16px',
    opacity: 0.8,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
};

export const AnalysisPage: React.FC = () => {
  const { status, stage, result, error, analyze, cancel, reset } = useAnalysis();

  const handleAnalyze = useCallback(
    (input: AnalysisInput) => {
      analyze(input);
    },
    [analyze]
  );

  const handleShare = useCallback(() => {
    console.log('Share button clicked, result:', result);
    if (!result) return;

    const category = result.score <= 40
      ? 'Low Credibility'
      : result.score <= 70
        ? 'Moderate Credibility'
        : 'High Credibility';

    const shareText = `Credibility Analysis Result

Score: ${result.score}/100 (${category})
Source: ${result.metadata?.sourceUrl || result.input.value}

${result.overview}

Red Flags: ${result.redFlags.length}
${result.redFlags.slice(0, 3).map(flag => `• ${flag.description}`).join('\n')}

Positive Indicators: ${result.positiveIndicators.length}
${result.positiveIndicators.slice(0, 3).map(indicator => `• ${indicator.description}`).join('\n')}

Analyzed on ${new Date(result.timestamp).toLocaleDateString()}`;

    console.log('Share text:', shareText);

    // Always copy to clipboard first
    navigator.clipboard.writeText(shareText).then(() => {
      alert('Analysis summary copied to clipboard!');
    }).catch((err) => {
      console.error('Clipboard write failed:', err);
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('Analysis summary copied to clipboard!');
    });
  }, [result]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadAnalysisPDF(result);
  }, [result]);

  const handleRetry = useCallback(() => {
    reset();
  }, [reset]);

  const renderContent = () => {
    // Loading state
    if (status === 'loading' && stage) {
      return <LoadingSpinner stage={stage} onCancel={cancel} />;
    }

    // Error state
    if (status === 'error' && error) {
      return (
        <div style={styles.errorContainer} data-testid="error-container">
          <h3 style={styles.errorTitle}>Analysis Failed</h3>
          <p style={styles.errorMessage}>{error.message}</p>
          {error.suggestedAction && (
            <p style={styles.errorAction}>{error.suggestedAction}</p>
          )}
          <button
            style={styles.retryButton}
            onClick={handleRetry}
            data-testid="retry-button"
          >
            Try Again
          </button>
        </div>
      );
    }

    // Success state - show results
    if (status === 'success' && result) {
      return (
        <div style={styles.resultsSection} data-testid="results-section">
          <ScoreDisplay
            score={result.score}
            timestamp={result.timestamp}
            onShare={handleShare}
            onDownload={handleDownload}
          />
          <ExplanationPanel analysis={result} />
          <button
            style={styles.newAnalysisButton}
            onClick={handleRetry}
            data-testid="new-analysis-button"
          >
            Start New Analysis
          </button>
        </div>
      );
    }

    // Idle state - show input
    return (
      <InputSection
        onAnalyze={handleAnalyze}
        isLoading={status === 'loading'}
      />
    );
  };

  return (
    <div style={styles.container} data-testid="analysis-page">
      <header style={styles.header}>
        <h1 style={styles.title}>Credibility Analysis</h1>
        <p style={styles.subtitle}>
          Enter a URL or paste text to analyze its credibility
        </p>
      </header>
      <main style={styles.content}>{renderContent()}</main>
    </div>
  );
};
