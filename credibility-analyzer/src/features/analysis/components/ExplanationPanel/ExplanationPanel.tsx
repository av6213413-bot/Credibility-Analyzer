import React, { useState } from 'react';
import type { AnalysisResult, RedFlag, PositiveIndicator, Keyword } from '../../../../types';
import { styles, getSeverityStyle } from './ExplanationPanel.styles';

export interface ExplanationPanelProps {
  analysis: AnalysisResult;
}

type TabId = 'overview' | 'red-flags' | 'positive' | 'keywords';

interface TabConfig {
  id: TabId;
  label: string;
}

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'red-flags', label: 'Red Flags' },
  { id: 'positive', label: 'Positive Indicators' },
  { id: 'keywords', label: 'Keywords' },
];

// Overview Tab Component
const OverviewTab: React.FC<{ overview: string }> = ({ overview }) => (
  <div style={styles.overviewText}>{overview || 'No overview available.'}</div>
);

// Red Flags Tab Component
interface RedFlagsTabProps {
  redFlags: RedFlag[];
}

export const RedFlagsTab: React.FC<RedFlagsTabProps> = ({ redFlags }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (redFlags.length === 0) {
    return <div style={styles.emptyState}>No red flags detected.</div>;
  }

  return (
    <div style={styles.redFlagsList}>
      {redFlags.map((flag) => {
        const isExpanded = expandedIds.has(flag.id);
        return (
          <div key={flag.id} style={styles.redFlagItem} data-testid={`red-flag-${flag.id}`}>
            <button
              style={styles.redFlagHeader}
              onClick={() => toggleExpand(flag.id)}
              aria-expanded={isExpanded}
              aria-controls={`red-flag-content-${flag.id}`}
            >
              <div style={styles.redFlagHeaderContent}>
                <span
                  style={{ ...styles.severityBadge, ...getSeverityStyle(flag.severity) }}
                  data-testid={`severity-badge-${flag.id}`}
                  data-severity={flag.severity}
                >
                  {flag.severity}
                </span>
                <span style={styles.redFlagDescription}>{flag.description}</span>
              </div>
              <span
                style={{
                  ...styles.expandIcon,
                  ...(isExpanded ? styles.expandIconOpen : {}),
                }}
              >
                ▼
              </span>
            </button>
            {isExpanded && (
              <div
                id={`red-flag-content-${flag.id}`}
                style={styles.redFlagContent}
                data-testid={`red-flag-content-${flag.id}`}
              >
                Additional details about this red flag: {flag.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Positive Indicators Tab Component
interface PositiveTabProps {
  indicators: PositiveIndicator[];
}

export const PositiveTab: React.FC<PositiveTabProps> = ({ indicators }) => {
  if (indicators.length === 0) {
    return <div style={styles.emptyState}>No positive indicators found.</div>;
  }

  return (
    <div style={styles.positiveList}>
      {indicators.map((indicator) => (
        <div
          key={indicator.id}
          style={styles.positiveItem}
          data-testid={`positive-indicator-${indicator.id}`}
        >
          <span style={styles.positiveIcon} role="img" aria-label="indicator icon">
            {indicator.icon}
          </span>
          <span style={styles.positiveDescription}>{indicator.description}</span>
        </div>
      ))}
    </div>
  );
};

// Keywords Tab Component
interface KeywordsTabProps {
  keywords: Keyword[];
}

export const KeywordsTab: React.FC<KeywordsTabProps> = ({ keywords }) => {
  if (keywords.length === 0) {
    return <div style={styles.emptyState}>No keywords identified.</div>;
  }

  return (
    <div style={styles.keywordsList}>
      {keywords.map((keyword, index) => (
        <span
          key={`${keyword.term}-${index}`}
          style={{
            ...styles.keywordItem,
            ...(keyword.impact === 'positive' ? styles.keywordPositive : styles.keywordNegative),
          }}
          data-testid={`keyword-${keyword.term}`}
          data-impact={keyword.impact}
        >
          {keyword.term}
          <span style={styles.keywordWeight}>({keyword.weight.toFixed(1)})</span>
        </span>
      ))}
    </div>
  );
};

// Main ExplanationPanel Component
export const ExplanationPanel: React.FC<ExplanationPanelProps> = ({ analysis }) => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab overview={analysis.overview} />;
      case 'red-flags':
        return <RedFlagsTab redFlags={analysis.redFlags} />;
      case 'positive':
        return <PositiveTab indicators={analysis.positiveIndicators} />;
      case 'keywords':
        return <KeywordsTab keywords={analysis.keywords} />;
      default:
        return null;
    }
  };

  return (
    <div style={styles.container} data-testid="explanation-panel">
      <div style={styles.tabList} role="tablist" aria-label="Analysis explanation tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        style={styles.tabContent}
        data-testid={`tabpanel-${activeTab}`}
      >
        {renderTabContent()}
      </div>
    </div>
  );
};
