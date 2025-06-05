import React, { useState, useRef } from 'react';
import AnalyticsExport from './utils/AnalyticsExport';

/**
 * ExportPanel Component
 * A reusable panel for exporting dashboard data in various formats
 * 
 * @param {Object} props
 * @param {Array|Object} props.data - Data to be exported
 * @param {String} props.filename - Base filename for exports (without extension)
 * @param {String} props.title - Title used in email subject and PDF header
 * @param {Function} props.onExport - Optional callback when export is complete
 */
const ExportPanel = ({ data, filename = 'report', title = 'Analytics Report', onExport }) => {
  const [emailTo, setEmailTo] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [exportStatus, setExportStatus] = useState({ message: '', type: '' });
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef(null);

  // Utility: Email validation
  function validateEmail(email) {
    // Simple RFC 5322 compliant regex
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Handle CSV export
  const handleCSVExport = () => {
    try {
      AnalyticsExport.exportToCSV(data, filename);
      setExportStatus({ message: 'CSV export successful', type: 'success' });
      if (onExport) onExport('csv');
    } catch (error) {
      console.error('CSV export error:', error);
      setExportStatus({ message: 'CSV export failed', type: 'error' });
    }
  };

  // Handle PDF export
  const handlePDFExport = async () => {
    try {
      setIsExporting(true);
      setExportStatus({ message: 'Generating PDF...', type: 'info' });
      
      // If we have a container ref and it's for a dashboard, use it
      // Otherwise, we'll create a report from the data
      if (containerRef.current && containerRef.current.parentElement) {
        const targetElement = containerRef.current.parentElement;
        await AnalyticsExport.exportToPDF(targetElement, filename);
        setExportStatus({ message: 'PDF export successful', type: 'success' });
      } else {
        // In case we don't have a proper element to capture, create a simple data report
        const reportText = AnalyticsExport.generateReport(data, title);
        console.log('Generated report for PDF:', reportText);
        setExportStatus({ message: 'PDF feature requires dashboard element', type: 'warning' });
      }
      
      if (onExport) onExport('pdf');
    } catch (error) {
      console.error('PDF export error:', error);
      setExportStatus({ message: 'PDF export failed', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Email export
  const handleEmailExport = () => {
    if (!emailTo) {
      setExportStatus({ message: 'Please enter an email address', type: 'warning' });
      return;
    }
    if (!validateEmail(emailTo)) {
      setExportStatus({ message: 'Invalid email address format', type: 'error' });
      return;
    }
    setIsExporting(true);
    try {
      // Generate a report from the data
      const reportText = AnalyticsExport.generateReport(data, title);
      AnalyticsExport.sendEmail(reportText, emailTo, `${title} - ${new Date().toLocaleDateString()}`);
      
      setExportStatus({ message: 'Email prepared', type: 'success' });
      setShowEmailInput(false);
      setEmailTo('');
      
      if (onExport) onExport('email');
    } catch (error) {
      console.error('Email export error:', error);
      setExportStatus({ message: 'Email preparation failed', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  // Toggle email input visibility
  const toggleEmailInput = () => {
    setShowEmailInput(!showEmailInput);
    if (!showEmailInput) {
      setExportStatus({ message: '', type: '' });
    }
  };

  return (
    <div className="export-panel" ref={containerRef}>
      <div className="export-panel-header">
        <h3>Export Options</h3>
      </div>
      
      <div className="export-panel-buttons">
        <button 
          className="export-button csv-button" 
          onClick={handleCSVExport}
          disabled={!data || (Array.isArray(data) && data.length === 0)}
        >
          <span className="export-icon">📊</span>
          <span>CSV</span>
        </button>
        
        <button 
          className="export-button pdf-button" 
          onClick={handlePDFExport}
          disabled={!data}
        >
          <span className="export-icon">📄</span>
          <span>PDF</span>
        </button>
        
        <button 
          className="export-button email-button" 
          onClick={toggleEmailInput}
          disabled={!data}
        >
          <span className="export-icon">📧</span>
          <span>Email</span>
        </button>
      </div>
      
      {showEmailInput && (
        <div className="email-input-container">
          <input
            type="email"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="Enter email address"
            className="email-input"
          />
          <button 
            className="send-email-button"
            onClick={handleEmailExport}
            disabled={!emailTo}
          >
            Send
          </button>
        </div>
      )}
      
      {exportStatus.message && (
        <div className={`export-status ${exportStatus.type}`}>
          {exportStatus.message}
        </div>
      )}

      {isExporting && (
        <div className="export-loading-indicator">
          <span className="spinner" role="status" aria-live="polite">⏳ Exporting...</span>
        </div>
      )}
    </div>
  );
};

export default ExportPanel;

// Ensure all export panel text and backgrounds use brand palette for maximum contrast.
// Add export options for analytics and genealogy tree if present in data prop.
// Ensure all buttons and controls use correct brand colors and gradients.
// Add ARIA and accessibility improvements.
// Remove any hardcoded black text.
// Prepare for production.