import React, { Component } from 'react';
import './OrphiChainEnhanced.css';

/**
 * ErrorBoundary Component
 * 
 * A comprehensive error boundary that catches JavaScript errors anywhere in the child
 * component tree, logs those errors, and displays a fallback UI instead of the 
 * component tree that crashed.
 * 
 * Features:
 * - Catches and logs all JavaScript errors in child components
 * - Provides detailed error information for debugging
 * - Graceful fallback UI with retry functionality
 * - Error reporting capabilities
 * - OrphiChain-branded error display
 * - Accessibility support with proper ARIA labels
 * 
 * @component
 * @param {React.ReactNode} children - Child components to wrap
 * @param {string} [fallbackComponent] - Custom fallback component name
 * @param {boolean} [showDetails=false] - Whether to show detailed error information
 * @param {function} [onError] - Callback function when error occurs
 * @param {boolean} [enableReporting=false] - Whether to enable error reporting
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      isReporting: false
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error, errorInfo) {
    // Store error details
    this.setState({
      error,
      errorInfo
    });

    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report error if reporting is enabled
    if (this.props.enableReporting) {
      this.reportError(error, errorInfo);
    }
  }

  reportError = async (error, errorInfo) => {
    this.setState({ isReporting: true });

    try {
      // In a real application, this would send to an error reporting service
      const errorReport = {
        id: this.state.errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: localStorage.getItem('orphi-user-id') || 'anonymous'
      };

      // Simulate API call to error reporting service
      console.log('Error report:', errorReport);
      
      // In production, replace with actual error reporting service
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorReport)
      // });

    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    } finally {
      this.setState({ isReporting: false });
    }
  };

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  copyErrorDetails = () => {
    const errorDetails = {
      id: this.state.errorId,
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      timestamp: new Date().toISOString()
    };

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => {
        // Show copy success feedback
        const button = document.querySelector('.copy-error-btn');
        if (button) {
          const originalText = button.textContent;
          button.textContent = 'Copied!';
          setTimeout(() => {
            button.textContent = originalText;
          }, 2000);
        }
      })
      .catch(err => {
        console.error('Failed to copy error details:', err);
      });
  };

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    });
  };

  render() {
    if (this.state.hasError) {
      const { fallbackComponent, showDetails } = this.props;
      const { error, errorInfo, errorId, retryCount, isReporting } = this.state;

      return (
        <div className="error-boundary-container" role="alert" aria-live="assertive">
          <div className="error-boundary-content">
            {/* Error Header */}
            <div className="error-boundary-header">
              <div className="error-icon">⚠️</div>
              <div className="error-title">
                <h2>Oops! Something went wrong</h2>
                <p className="error-subtitle">
                  {fallbackComponent 
                    ? `The ${fallbackComponent} component encountered an error` 
                    : 'We encountered an unexpected error'
                  }
                </p>
              </div>
            </div>

            {/* Error ID */}
            <div className="error-id">
              <span className="error-id-label">Error ID:</span>
              <code className="error-id-value">{errorId}</code>
            </div>

            {/* Error Actions */}
            <div className="error-boundary-actions">
              <button 
                className="retry-btn primary-btn"
                onClick={this.handleRetry}
                disabled={retryCount >= 3}
                aria-label="Retry loading the component"
              >
                {retryCount >= 3 ? 'Max retries reached' : `Retry (${retryCount}/3)`}
              </button>
              
              <button 
                className="reload-btn secondary-btn"
                onClick={this.handleReload}
                aria-label="Reload the entire application"
              >
                Reload App
              </button>

              {showDetails && (
                <button 
                  className="copy-error-btn secondary-btn"
                  onClick={this.copyErrorDetails}
                  aria-label="Copy error details to clipboard"
                >
                  Copy Error Details
                </button>
              )}
            </div>

            {/* Error Details (if enabled) */}
            {showDetails && error && (
              <details className="error-details">
                <summary className="error-details-summary">
                  View Error Details
                </summary>
                <div className="error-details-content">
                  <div className="error-section">
                    <h4>Error Message</h4>
                    <pre className="error-message">{error.message}</pre>
                  </div>
                  
                  <div className="error-section">
                    <h4>Stack Trace</h4>
                    <pre className="error-stack">{error.stack}</pre>
                  </div>
                  
                  {errorInfo && (
                    <div className="error-section">
                      <h4>Component Stack</h4>
                      <pre className="error-component-stack">{errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Error Reporting Status */}
            {this.props.enableReporting && (
              <div className="error-reporting-status">
                {isReporting ? (
                  <div className="reporting-spinner">
                    <span className="spinner"></span>
                    <span>Reporting error...</span>
                  </div>
                ) : (
                  <div className="reporting-success">
                    <span className="success-icon">✅</span>
                    <span>Error reported automatically</span>
                  </div>
                )}
              </div>
            )}

            {/* Help Links */}
            <div className="error-help-links">
              <a 
                href="/docs/troubleshooting" 
                className="help-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                📚 Troubleshooting Guide
              </a>
              <a 
                href="/support" 
                className="help-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                🆘 Contact Support
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC for wrapping components with error boundary
 * @param {React.Component} WrappedComponent - Component to wrap
 * @param {object} errorBoundaryProps - Props to pass to ErrorBoundary
 * @returns {React.Component} Wrapped component with error boundary
 */
export const withErrorBoundary = (WrappedComponent, errorBoundaryProps = {}) => {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const WithErrorBoundaryComponent = (props) => (
    <ErrorBoundary 
      fallbackComponent={displayName}
      {...errorBoundaryProps}
    >
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${displayName})`;
  return WithErrorBoundaryComponent;
};

/**
 * Hook for manually triggering error boundary
 * @returns {function} Function to trigger error boundary
 */
export const useErrorHandler = () => {
  return (error, errorInfo) => {
    // This will be caught by the nearest error boundary
    throw new Error(error);
  };
};

export default ErrorBoundary;
