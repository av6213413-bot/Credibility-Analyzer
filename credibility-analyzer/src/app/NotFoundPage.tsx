import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants';

export const NotFoundPage: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>404</h1>
      <h2 style={{ marginBottom: '1rem' }}>Page Not Found</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-secondary)' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <nav style={{ display: 'flex', gap: '1rem' }}>
        <Link
          to={ROUTES.HOME}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            borderRadius: '0.5rem',
            textDecoration: 'none',
          }}
        >
          Go Home
        </Link>
        <Link
          to={ROUTES.ANALYSIS}
          style={{
            padding: '0.75rem 1.5rem',
            border: '1px solid var(--color-border)',
            borderRadius: '0.5rem',
            textDecoration: 'none',
          }}
        >
          Start Analysis
        </Link>
      </nav>
    </div>
  );
};
