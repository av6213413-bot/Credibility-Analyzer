import type { Theme } from './lightTheme';

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    background: '#1a1a1a',
    surface: '#2d2d2d',
    textPrimary: '#ffffff',
    textSecondary: '#a0a0a0',
    border: '#404040',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    error: '#f87171',
    warning: '#fbbf24',
    success: '#4ade80',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '1rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
  },
};
