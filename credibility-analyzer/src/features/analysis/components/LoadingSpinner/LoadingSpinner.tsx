import { useState, useEffect } from 'react';
import type { AnalysisStage } from '../../../../types';
import { STAGE_MESSAGES } from '../../../../types';
import { styles, spinnerKeyframes } from './LoadingSpinner.styles';

export interface LoadingSpinnerProps {
  stage: AnalysisStage;
  onCancel: () => void;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  stage,
  onCancel,
}) => {
  const [isHovering, setIsHovering] = useState(false);

  // Inject keyframes into document head
  useEffect(() => {
    const styleId = 'loading-spinner-keyframes';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = spinnerKeyframes;
      document.head.appendChild(styleElement);
    }
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  const stageMessage = STAGE_MESSAGES[stage];

  return (
    <div style={styles.container} data-testid="loading-spinner">
      <div style={styles.spinnerWrapper}>
        <div style={styles.spinner} data-testid="spinner-animation" />
      </div>
      <p style={styles.stageMessage} data-testid="stage-message">
        {stageMessage}
      </p>
      <button
        type="button"
        style={{
          ...styles.cancelButton,
          ...(isHovering ? styles.cancelButtonHover : {}),
        }}
        onClick={onCancel}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        data-testid="cancel-button"
      >
        Cancel
      </button>
    </div>
  );
};
