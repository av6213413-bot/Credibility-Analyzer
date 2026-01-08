import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import type { AnalysisResult } from '@/types';

/**
 * Get credibility label based on score
 */
const getCredibilityLabel = (score: number): string => {
  if (score <= 40) return 'Low Credibility';
  if (score <= 70) return 'Moderate Credibility';
  return 'High Credibility';
};

/**
 * Get color for score category
 */
const getScoreColor = (score: number): [number, number, number] => {
  if (score <= 40) return [239, 68, 68]; // Red
  if (score <= 70) return [234, 179, 8]; // Yellow
  return [34, 197, 94]; // Green
};

/**
 * Export analysis result to PDF
 * Requirements: 9.2
 */
export const exportAnalysisToPDF = (analysis: AnalysisResult): Blob => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Credibility Analysis Report', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Timestamp
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const formattedDate = format(new Date(analysis.timestamp), "MMMM d, yyyy 'at' h:mm a");
  doc.text('Generated: ' + formattedDate, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;

  // Score section
  const scoreColor = getScoreColor(analysis.score);
  doc.setFontSize(48);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.text(analysis.score.toString(), pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  doc.setFontSize(14);
  doc.text(getCredibilityLabel(analysis.score), pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Source info
  if (analysis.metadata.title || analysis.metadata.sourceUrl) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Source Information', 20, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (analysis.metadata.title) {
      doc.text('Title: ' + analysis.metadata.title, 20, yPosition);
      yPosition += 6;
    }
    if (analysis.metadata.sourceUrl) {
      doc.text('URL: ' + analysis.metadata.sourceUrl, 20, yPosition);
      yPosition += 6;
    }
    yPosition += 10;
  }

  // Overview
  if (analysis.overview) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Overview', 20, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const overviewLines = doc.splitTextToSize(analysis.overview, pageWidth - 40);
    doc.text(overviewLines, 20, yPosition);
    yPosition += overviewLines.length * 5 + 10;
  }

  // Red Flags
  if (analysis.redFlags.length > 0) {
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text('Red Flags (' + analysis.redFlags.length + ')', 20, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    analysis.redFlags.forEach((flag) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      const severityLabel = '[' + flag.severity.toUpperCase() + '] ';
      doc.text('• ' + severityLabel + flag.description, 25, yPosition);
      yPosition += 6;
    });
    yPosition += 10;
  }

  // Positive Indicators
  if (analysis.positiveIndicators.length > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text('Positive Indicators (' + analysis.positiveIndicators.length + ')', 20, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    analysis.positiveIndicators.forEach((indicator) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text('• ' + indicator.description, 25, yPosition);
      yPosition += 6;
    });
    yPosition += 10;
  }

  // Keywords
  if (analysis.keywords.length > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Key Terms', 20, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const keywordText = analysis.keywords
      .map((kw) => kw.term + ' (' + kw.impact + ')')
      .join(', ');
    const keywordLines = doc.splitTextToSize(keywordText, pageWidth - 40);
    doc.text(keywordLines, 20, yPosition);
  }

  // Return as Blob
  return doc.output('blob');
};

/**
 * Download PDF report for an analysis
 */
export const downloadAnalysisPDF = (analysis: AnalysisResult): void => {
  const blob = exportAnalysisToPDF(analysis);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'credibility-report-' + analysis.id + '.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
