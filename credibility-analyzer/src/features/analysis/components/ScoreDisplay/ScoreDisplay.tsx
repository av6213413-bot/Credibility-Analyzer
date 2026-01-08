/**
 * ScoreDisplay Component
 * Displays credibility score with circular progress indicator and color coding
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { styles, scoreAnimationKeyframes, getScoreCategory } from './ScoreDisplay.styles';

export interface ScoreDisplayProps {
  score: number;
  timestamp: Date;
  onShare: () => void;
  onDownload: () => void;
}

// SVG circle constants
const CIRCLE_RADIUS = 68;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  score,
  timestamp,
  onShare,
  onDownload,
}) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [shareHover, setShareHover] = useState(false);
  const [downloadHover, setDownloadHover] = useState(false);

  // Inject keyframes into document head
  useEffect(() => {
    const styleId = 'score-display-keyframes';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = scoreAnimationKeyframes;
      document.head.appendChild(styleElement);
    }
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // Animate score from 0 to final value (Requirement 2.5)
  useEffect(() => {
    const duration = 1000; // 1 second animation
    const startTime = Date.now();
    const targetScore = Math.max(0, Math.min(100, score));

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentScore = Math.round(easeOut * targetScore);
      
      setAnimatedScore(currentScore);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score]);

  // Get score category for color and label
  const category = getScoreCategory(score);
  
  // Calculate stroke dash offset for circular progress
  const strokeDashoffset = CIRCLE_CIRCUMFERENCE - (animatedScore / 100) * CIRCLE_CIRCUMFERENCE;

  // Format timestamp
  const formattedTimestamp = format(timestamp, "MMM d, yyyy 'at' h:mm a");

  const handleShare = useCallback(() => {
    onShare();
  }, [onShare]);

  const handleDownload = useCallback(() => {
    onDownload();
  }, [onDownload]);

  return (
    <div style={styles.container} data-testid="score-display">
      {/* Circular Progress Indicator */}
      <div style={styles.scoreWrapper}>
        <svg style={styles.circularProgress} viewBox="0 0 160 160">
          {/* Background circle */}
          <circle
            style={styles.circleBackground}
            cx="80"
            cy="80"
            r={CIRCLE_RADIUS}
            data-testid="circle-background"
          />
          {/* Progress circle */}
          <circle
            style={{
              ...styles.circleProgress,
              stroke: category.color,
              strokeDasharray: CIRCLE_CIRCUMFERENCE,
              strokeDashoffset,
            }}
            cx="80"
            cy="80"
            r={CIRCLE_RADIUS}
            data-testid="circle-progress"
          />
        </svg>
        
        {/* Score text overlay */}
        <div style={styles.scoreText}>
          <span
            style={{ ...styles.scoreValue, color: category.color }}
            data-testid="score-value"
          >
            {animatedScore}
          </span>
          <span style={styles.scoreLabel}>out of 100</span>
        </div>
      </div>

      {/* Credibility Label */}
      <div
        style={{ ...styles.credibilityLabel, color: category.color }}
        data-testid="credibility-label"
      >
        {category.label}
      </div>

      {/* Timestamp */}
      <div style={styles.timestamp} data-testid="timestamp">
        Analyzed on {formattedTimestamp}
      </div>

      {/* Action Buttons */}
      <div style={styles.buttonGroup}>
        <button
          style={{
            ...styles.actionButton,
            ...(shareHover ? styles.actionButtonHover : {}),
          }}
          onClick={handleShare}
          onMouseEnter={() => setShareHover(true)}
          onMouseLeave={() => setShareHover(false)}
          data-testid="share-button"
          aria-label="Share analysis results"
        >
          <ShareIcon />
          Share
        </button>
        <button
          style={{
            ...styles.actionButton,
            ...(downloadHover ? styles.actionButtonHover : {}),
          }}
          onClick={handleDownload}
          onMouseEnter={() => setDownloadHover(true)}
          onMouseLeave={() => setDownloadHover(false)}
          data-testid="download-button"
          aria-label="Download PDF report"
        >
          <DownloadIcon />
          Download PDF
        </button>
      </div>
    </div>
  );
};

// Simple SVG icons
const ShareIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const DownloadIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
