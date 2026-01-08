import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/shared/context';
import { AnalysisProvider } from '@/features/analysis';
import type { ReactElement, ReactNode } from 'react';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialTheme?: 'light' | 'dark';
  initialRoute?: string;
  withAnalysisProvider?: boolean;
}

export const renderWithProviders = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const {
    initialTheme = 'light',
    initialRoute = '/',
    withAnalysisProvider = false,
    ...renderOptions
  } = options;

  const Wrapper = ({ children }: { children: ReactNode }) => {
    const content = withAnalysisProvider ? (
      <AnalysisProvider>{children}</AnalysisProvider>
    ) : (
      children
    );

    return (
      <MemoryRouter initialEntries={[initialRoute]}>
        <ThemeProvider initialTheme={initialTheme}>{content}</ThemeProvider>
      </MemoryRouter>
    );
  };

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};
