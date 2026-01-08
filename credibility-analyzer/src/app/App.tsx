import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/shared/context';
import { AnalysisProvider } from '@/features/analysis';
import { ErrorBoundary, Header } from '@/shared/components';
import { AppRoutes } from './AppRoutes';
import '@/styles/globalStyles.css';

/**
 * Root App component
 * Integrates all providers and sets up the application structure
 * Requirements: 6.3, 7.1, 7.2
 */
export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ErrorBoundary>
          <AnalysisProvider>
            <div className="app-container">
              <Header />
              <main className="main-content">
                <AppRoutes />
              </main>
            </div>
          </AnalysisProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  );
};
