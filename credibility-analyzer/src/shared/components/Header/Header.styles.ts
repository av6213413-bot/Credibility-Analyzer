import type { CSSProperties } from 'react';

export const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    backgroundColor: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    flexWrap: 'nowrap',
  } as CSSProperties,

  logo: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--color-primary)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  } as CSSProperties,

  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  } as CSSProperties,

  navMobile: {
    display: 'none',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--color-background)',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2rem',
    zIndex: 200,
    padding: '2rem',
  } as CSSProperties,

  navMobileOpen: {
    display: 'flex',
  } as CSSProperties,

  navLink: {
    color: 'var(--color-text-primary)',
    textDecoration: 'none',
    fontSize: '1rem',
    fontWeight: 500,
    padding: '0.5rem 0',
    borderBottom: '2px solid transparent',
    transition: 'border-color 0.2s ease, color 0.2s ease',
  } as CSSProperties,

  navLinkActive: {
    color: 'var(--color-primary)',
    borderBottomColor: 'var(--color-primary)',
  } as CSSProperties,

  // Mobile nav link styles (larger touch targets)
  navLinkMobile: {
    fontSize: '1.25rem',
    padding: '0.75rem 1rem',
  } as CSSProperties,

  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  } as CSSProperties,

  themeToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '1px solid var(--color-border)',
    backgroundColor: 'transparent',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
    fontSize: '1.25rem',
    flexShrink: 0,
  } as CSSProperties,

  hamburger: {
    display: 'none',
    flexDirection: 'column',
    justifyContent: 'space-between',
    width: '24px',
    height: '18px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    zIndex: 300,
    flexShrink: 0,
  } as CSSProperties,

  hamburgerLine: {
    width: '100%',
    height: '2px',
    backgroundColor: 'var(--color-text-primary)',
    transition: 'transform 0.2s ease, opacity 0.2s ease',
  } as CSSProperties,

  hamburgerLineOpen1: {
    transform: 'rotate(45deg) translate(5px, 5px)',
  } as CSSProperties,

  hamburgerLineOpen2: {
    opacity: 0,
  } as CSSProperties,

  hamburgerLineOpen3: {
    transform: 'rotate(-45deg) translate(5px, -5px)',
  } as CSSProperties,

  closeButton: {
    position: 'absolute',
    top: '1rem',
    right: '2rem',
    background: 'none',
    border: 'none',
    fontSize: '2rem',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    padding: '0.5rem',
    lineHeight: 1,
  } as CSSProperties,
};

// Media query breakpoint
export const MOBILE_BREAKPOINT = 768;
