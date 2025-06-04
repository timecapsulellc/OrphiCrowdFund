// AnalyticsExport.js
// Utility class for exporting analytics data in various formats

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

class AnalyticsExport {
  /**
   * Export data to CSV format
   * @param {Array} data - Array of objects to be exported
   * @param {String} filename - Name of the file to be downloaded
   */
  static exportToCSV(data, filename = 'export') {
    if (!data || !data.length) {
      console.error('No data to export');
      return;
    }

    // Get headers from the first object
    const headers = Object.keys(data[0]);
    
    // Create CSV rows
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        // Handle special characters and ensure proper CSV format
        const escaped = ('' + (value || '')).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    
    // Combine into CSV content
    const csvContent = csvRows.join('\n');
    
    // Create a Blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${filename}.csv`);
    
    return true;
  }

  /**
   * Export HTML element to PDF
   * @param {HTMLElement} element - DOM element to be exported
   * @param {String} filename - Name of the file to be downloaded
   * @param {Object} options - PDF export options
   */
  static async exportToPDF(element, filename = 'export', options = {}) {
    if (!element) {
      console.error('No element to export');
      return;
    }

    const defaultOptions = {
      margin: 10,
      quality: 2,
      width: null,
      height: null,
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    };

    // Merge options
    const pdfOptions = { ...defaultOptions, ...options };
    
    try {
      // Capture the element as canvas
      const canvas = await html2canvas(element, {
        scale: pdfOptions.quality,
        useCORS: true,
        logging: false
      });
      
      // Create PDF
      const pdf = new jsPDF(pdfOptions.orientation, pdfOptions.unit, pdfOptions.format);
      
      // Calculate dimensions
      const imgWidth = pdf.internal.pageSize.getWidth() - (pdfOptions.margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add image to PDF
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        pdfOptions.margin,
        pdfOptions.margin,
        imgWidth,
        imgHeight
      );
      
      // Save PDF
      pdf.save(`${filename}.pdf`);
      
      return true;
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      return false;
    }
  }

  /**
   * Send data via email
   * @param {Object} data - Data to be sent
   * @param {String} recipient - Email recipient
   * @param {String} subject - Email subject
   */
  static sendEmail(data, recipient, subject = 'OrphiChain Analytics Report') {
    if (!data) {
      console.error('No data to send');
      return;
    }

    if (!recipient || !recipient.includes('@')) {
      console.error('Invalid email recipient');
      return;
    }

    // In a real implementation, this would connect to an email service
    // For now, we'll just create a mailto link
    
    let mailtoLink;
    
    if (typeof data === 'string') {
      // If data is already a string, use it as the body
      mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(data)}`;
    } else {
      // Convert object to string
      const body = JSON.stringify(data, null, 2);
      mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
    
    // Open email client
    window.location.href = mailtoLink;
    
    return true;
  }

  /**
   * Generate a report as a formatted string
   * @param {Array|Object} data - Data to format
   * @param {String} title - Report title
   */
  static generateReport(data, title = 'OrphiChain Analytics Report') {
    if (!data) {
      return 'No data available';
    }

    let report = `${title}\n`;
    report += `Generated: ${new Date().toLocaleString()}\n\n`;

    if (Array.isArray(data)) {
      // If data is an array of objects
      if (data.length > 0 && typeof data[0] === 'object') {
        const headers = Object.keys(data[0]);
        
        // Add headers
        report += headers.join('\t') + '\n';
        report += headers.map(() => '---').join('\t') + '\n';
        
        // Add data rows
        for (const row of data) {
          report += headers.map(header => row[header]).join('\t') + '\n';
        }
      } else {
        // Simple array
        for (const item of data) {
          report += `${item}\n`;
        }
      }
    } else if (typeof data === 'object') {
      // Single object
      for (const [key, value] of Object.entries(data)) {
        report += `${key}: ${value}\n`;
      }
    } else {
      // Other data types
      report += String(data);
    }

    return report;
  }
}

export default AnalyticsExport;