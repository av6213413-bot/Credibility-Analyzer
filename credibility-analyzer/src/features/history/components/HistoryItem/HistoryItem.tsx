/**
 * HistoryItem Component
 * Displays a single history item with thumbnail, title, score, and date
 * Requirements: 4.2, 4.6
 */

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import type { HistoryItem as HistoryItemType } from '@/types';
import { styles, getScoreColor, getScoreLabel } from './HistoryItem.styles';

export interface HistoryItemProps {
  item: HistoryItemType;
  onDelete: (id: string) => void;
  onClick?: (id: string) => void;
}

export const HistoryItem: React.FC<HistoryItemProps> = ({
  item,
  onDelete,
  onClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [deleteHovered, setDeleteHovered] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const scoreColor = getScoreColor(item.score);
  const scoreLabel = getScoreLabel(item.score);
  const formattedDate = format(new Date(item.timestamp), 'MMM d, yyyy');

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(item.id);
    }
  }, [onClick, item.id]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    onDelete(item.id);
    setShowConfirm(false);
  }, [onDelete, item.id]);

  const handleCancelDelete = useCallback(() => {
    setShowConfirm(false);
  }, []);

  return (
    <>
      <div
        style={{
          ...styles.container,
          ...(isHovered ? styles.containerHover : {}),
          cursor: onClick ? 'pointer' : 'default',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        data-testid="history-item"
        role="article"
        aria-label={`Analysis: ${item.title}`}
      >
        {/* Thumbnail */}
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt=""
            style={styles.thumbnail}
            data-testid="history-item-thumbnail"
          />
        ) : (
          <div style={styles.thumbnailPlaceholder} data-testid="history-item-thumbnail-placeholder">
            <DocumentIcon />
          </div>
        )}

        {/* Content */}
        <div style={styles.content}>
          <h3 style={styles.title} data-testid="history-item-title">
            {item.title}
          </h3>
          <p style={styles.date} data-testid="history-item-date">
            {formattedDate}
          </p>
        </div>

        {/* Score */}
        <div style={styles.scoreContainer}>
          <span
            style={{ ...styles.scoreValue, color: scoreColor }}
            data-testid="history-item-score"
          >
            {item.score}
          </span>
          <span
            style={{ ...styles.scoreLabel, color: scoreColor }}
            data-testid="history-item-score-label"
          >
            {scoreLabel}
          </span>
        </div>

        {/* Delete Button */}
        <button
          style={{
            ...styles.deleteButton,
            ...(deleteHovered ? styles.deleteButtonHover : {}),
          }}
          onMouseEnter={() => setDeleteHovered(true)}
          onMouseLeave={() => setDeleteHovered(false)}
          onClick={handleDeleteClick}
          data-testid="history-item-delete-button"
          aria-label="Delete this analysis"
        >
          <TrashIcon />
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div
          style={styles.confirmOverlay}
          onClick={handleCancelDelete}
          data-testid="delete-confirm-overlay"
        >
          <div
            style={styles.confirmDialog}
            onClick={(e) => e.stopPropagation()}
            data-testid="delete-confirm-dialog"
            role="dialog"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
          >
            <h4 id="confirm-title" style={styles.confirmTitle}>
              Delete Analysis?
            </h4>
            <p id="confirm-message" style={styles.confirmMessage}>
              Are you sure you want to delete this analysis? This action cannot be undone.
            </p>
            <div style={styles.confirmButtons}>
              <button
                style={styles.cancelButton}
                onClick={handleCancelDelete}
                data-testid="delete-cancel-button"
              >
                Cancel
              </button>
              <button
                style={styles.confirmDeleteButton}
                onClick={handleConfirmDelete}
                data-testid="delete-confirm-button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Simple SVG icons
const DocumentIcon: React.FC = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const TrashIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);
