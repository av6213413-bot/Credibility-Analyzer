import type { CSSProperties } from 'react';

export const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
    padding: '2rem',
    backgroundColor: 'var(--color-surface)',
    borderRadius: '0.5rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    width: '100%',
    boxSizing: 'border-box',
  } as CSSProperties,

  scoreWrapper: {
    position: 'relative',
    width: '160px',
    height: '160px',
  } as CSSProperties,

  // Smaller score wrapper for mobile
  scoreWrapperMobile: {
    width: '120px',
    height: '120px',
  } as CSSProperties,

  circularProgress: {
    width: '100%',
    height: '100%',
    transform: 'rotate(-90deg)',
  } as CSSProperties,

  circleBackground: {
    fill: 'none',
    stroke: 'var(--color-border)',
    strokeWidth: 8,
  } as CSSProperties,

  circleProgress: {
    fill: 'none',
    strokeWidth: 8,
    strokeLinecap: 'round',
    transition: 'stroke-dashoffset 1s ease-out',
  } as CSSProperties,

  scoreText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  } as CSSProperties,

  scoreValue: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1,
  } as CSSProperties,

  // Smaller score value for mobile
  scoreValueMobile: {
    fontSize: '1.75rem',
  } as CSSProperties,

  scoreLabel: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  } as CSSProperties,

  credibilityLabel: {
    fontSize: '1.25rem',
    fontWeight: 600,
    textAlign: 'center',
  } as CSSProperties,

  timestamp: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
  } as CSSProperties,

  buttonGroup: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '0.5rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
  } as CSSProperties,

  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: '0.25rem',
    backgroundColor: 'transparent',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  } as CSSProperties,

  actionButtonHover: {
    backgroundColor: 'var(--color-surface-hover)',
    borderColor: 'var(--color-primary)',
  } as CSSProperties,
};

// CSS keyframes for score animation
export const scoreAnimationKeyframes = `
@keyframes scoreCountUp {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
`;

// Score category configuration
export interface ScoreCategory {
  min: number;
  max: number;
  color: string;
  label: string;
}

export const SCORE_CATEGORIES: ScoreCategory[] = [
  { min: 0, max: 40, color: '#ef4444', label: 'Low Credibility' },
  { min: 41, max: 70, color: '#eab308', label: 'Moderate Credibility' },
  { min: 71, max: 100, color: '#22c55e', label: 'High Credibility' },
];

/**
 * Get the score category based on the score value
 * @param score - The credibility score (0-100)
 * @returns The matching score category
 */
export const getScoreCategory = (score: number): ScoreCategory => {
  const clampedScore = Math.max(0, Math.min(100, score));
  
  for (const category of SCORE_CATEGORIES) {
    if (clampedScore >= category.min && clampedScore <= category.max) {
      return category;
    }
  }
  
  // Default to first category if no match (shouldn't happen with valid scores)
  return SCORE_CATEGORIES[0];
};
