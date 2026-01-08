import { Component, type ReactNode, type ErrorInfo } from 'react';
import { styles } from './ErrorBoundary.styles';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorDisplayProps {
  error: Error;
  errorInfo?: ErrorInfo | null;
  suggestedAction?: string;
  onRetry: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  errorInfo,
  suggestedAction,
  onRetry,
}) => {
  return (
    <div style={styles.container} role="alert">
      <div style={styles.icon}>⚠️</div>
      <h2 style={styles.title}>Something went wrong</h2>
      <p style={styles.message}>
        We encountered an unexpected error. Please try again or contact support if the problem
        persists.
      </p>

      <div style={styles.errorDetails}>
        <p style={styles.errorText}>{error.message}</p>
        {errorInfo?.componentStack && (
          <details>
            <summary style={{ cursor: 'pointer', marginTop: '0.5rem' }}>
              View technical details
            </summary>
            <pre style={{ ...styles.errorText, marginTop: '0.5rem', fontSize: '0.75rem' }}>
              {errorInfo.componentStack}
            </pre>
          </details>
        )}
      </div>

      {suggestedAction && <p style={styles.suggestedAction}>{suggestedAction}</p>}

      <button
        style={styles.retryButton}
        onClick={onRetry}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-primary)';
        }}
      >
        🔄 Try Again
      </button>
    </div>
  );
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error for debugging/monitoring
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback;
      }

      return (
        <ErrorDisplay error={error} errorInfo={errorInfo} onRetry={this.handleRetry} />
      );
    }

    return children;
  }
}
