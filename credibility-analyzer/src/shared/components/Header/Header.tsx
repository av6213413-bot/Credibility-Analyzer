import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '@/shared/hooks';
import { ROUTES } from '@/constants';
import { styles, MOBILE_BREAKPOINT } from './Header.styles';

interface NavItem {
  path: string;
  label: string;
}

const NAV_LINKS: NavItem[] = [
  { path: ROUTES.HOME, label: 'Home' },
  { path: ROUTES.ANALYSIS, label: 'Analysis' },
  { path: ROUTES.HISTORY, label: 'History' },
];

export const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if viewport is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu on route change
  const currentPath = location.pathname;
  useEffect(() => {
    // Only close if menu is open to avoid unnecessary state updates
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const getNavLinkStyle = (isActive: boolean) => ({
    ...styles.navLink,
    ...(isActive ? styles.navLinkActive : {}),
  });

  const renderNavLinks = () =>
    NAV_LINKS.map((link) => (
      <NavLink
        key={link.path}
        to={link.path}
        style={({ isActive }) => getNavLinkStyle(isActive)}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        {link.label}
      </NavLink>
    ));

  const themeIcon = theme === 'light' ? '🌙' : '☀️';

  return (
    <header style={styles.header}>
      <NavLink to={ROUTES.HOME} style={styles.logo}>
        Credibility Analyzer
      </NavLink>

      {/* Desktop Navigation */}
      {!isMobile && (
        <nav style={styles.nav} aria-label="Main navigation">
          {renderNavLinks()}
        </nav>
      )}

      <div style={styles.controls}>
        <button
          style={styles.themeToggle}
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {themeIcon}
        </button>

        {/* Hamburger Menu Button (Mobile) */}
        {isMobile && (
          <button
            style={{
              ...styles.hamburger,
              display: 'flex',
            }}
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
          >
            <span
              style={{
                ...styles.hamburgerLine,
                ...(isMobileMenuOpen ? styles.hamburgerLineOpen1 : {}),
              }}
            />
            <span
              style={{
                ...styles.hamburgerLine,
                ...(isMobileMenuOpen ? styles.hamburgerLineOpen2 : {}),
              }}
            />
            <span
              style={{
                ...styles.hamburgerLine,
                ...(isMobileMenuOpen ? styles.hamburgerLineOpen3 : {}),
              }}
            />
          </button>
        )}
      </div>

      {/* Mobile Navigation Menu */}
      {isMobile && (
        <nav
          style={{
            ...styles.navMobile,
            ...(isMobileMenuOpen ? styles.navMobileOpen : {}),
          }}
          aria-label="Mobile navigation"
          aria-hidden={!isMobileMenuOpen}
        >
          <button
            style={styles.closeButton}
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            ×
          </button>
          {renderNavLinks()}
        </nav>
      )}
    </header>
  );
};
