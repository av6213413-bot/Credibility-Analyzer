import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { storageService } from '@/services/storage';
import { lightTheme, darkTheme, type Theme } from '@/styles/theme';

export interface ThemeContextValue {
  theme: 'light' | 'dark';
  themeConfig: Theme;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: 'light' | 'dark';
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, initialTheme }) => {
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    if (initialTheme) return initialTheme;
    return storageService.getPreferences().theme;
  });

  const themeConfig = theme === 'light' ? lightTheme : darkTheme;

  const setTheme = useCallback((newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    const prefs = storageService.getPreferences();
    storageService.savePreferences({ ...prefs, theme: newTheme });
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      const prefs = storageService.getPreferences();
      storageService.savePreferences({ ...prefs, theme: newTheme });
      return newTheme;
    });
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, themeConfig, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
