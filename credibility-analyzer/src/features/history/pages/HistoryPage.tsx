/**
 * HistoryPage Component
 * Main page for viewing and managing analysis history
 * Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7
 */

import { useState, useCallback, type CSSProperties } from 'react';
import { HistoryList, HistoryFilters } from '../components';
import { useHistory } from '../hooks';
import { downloadHistoryCSV } from '@/services/export';
import { storageService } from '@/services/storage';

const styles: Record<string, CSSProperties> = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
  },
  header: {
    marginBottom: '24px',
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '16px',
  },
  headerText: {
    flex: 1,
    minWidth: '200px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '16px',
    color: '#6b7280',
    margin: 0,
  },
  exportButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  exportButtonHover: {
    backgroundColor: '#1d4ed8',
  },
  exportButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
};

export const HistoryPage: React.FC = () => {
  const [isExportHovered, setIsExportHovered] = useState(false);
  const {
    items,
    totalItems,
    currentPage,
    totalPages,
    filters,
    setFilters,
    resetFilters,
    setPage,
    deleteItem,
    isLoading,
  } = useHistory();

  const handleExport = useCallback(() => {
    const history = storageService.getHistory();
    if (history.length > 0) {
      downloadHistoryCSV(history);
    }
  }, []);

  const hasHistory = totalItems > 0 || storageService.getHistory().length > 0;

  const getExportButtonStyle = (): CSSProperties => {
    if (!hasHistory) {
      return { ...styles.exportButton, ...styles.exportButtonDisabled };
    }
    if (isExportHovered) {
      return { ...styles.exportButton, ...styles.exportButtonHover };
    }
    return styles.exportButton;
  };

  return (
    <div style={styles.container} data-testid="history-page">
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <div style={styles.headerText}>
            <h1 style={styles.title}>Analysis History</h1>
            <p style={styles.subtitle}>View and manage your previous credibility analyses.</p>
          </div>
          <button
            style={getExportButtonStyle()}
            onClick={handleExport}
            disabled={!hasHistory}
            onMouseEnter={() => setIsExportHovered(true)}
            onMouseLeave={() => setIsExportHovered(false)}
            data-testid="export-button"
            aria-label="Export history to CSV"
          >
            <ExportIcon />
            Export CSV
          </button>
        </div>
      </header>

      <div style={styles.content}>
        <HistoryFilters
          filters={filters}
          onFiltersChange={setFilters}
          onClear={resetFilters}
        />

        <HistoryList
          items={items}
          totalItems={totalItems}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          onDelete={deleteItem}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

// Export icon SVG component
const ExportIcon: React.FC = () => (
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
