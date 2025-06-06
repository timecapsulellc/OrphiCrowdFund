// EnhancedErrorFeedback.jsx - Comprehensive error handling and user guidance system
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './EnhancedErrorFeedback.css';

/**
 * EnhancedErrorFeedback - Production-ready error handling and user guidance
 * 
 * Features:
 * - Contextual error messages with solutions
 * - Smart retry mechanisms with exponential backoff
 * - User guidance for common issues
 * - Transaction status tracking
 * - Network error handling
 * - Accessibility support (ARIA, screen readers)
 * - Mobile-responsive design
 * - Error reporting and analytics
 */

const ERROR_TYPES = {
  NETWORK: 'network',
  TRANSACTION: 'transaction', 
  VALIDATION: 'validation',
  CONTRACT: 'contract',
  WALLET: 'wallet',
  SYSTEM: 'system',
  USER_INPUT: 'user_input'
};

const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

const EnhancedErrorFeedback = ({
  errors = [],
  onRetry,
  onDismiss,
  onReportError,
  showRetryButton = true,
  maxRetries = 3,
  enableErrorReporting = true,
  className = ''
}) => {
  const [expandedErrors, setExpandedErrors] = useState(new Set());
  const [retryAttempts, setRetryAttempts] = useState(new Map());
  const [dismissedErrors, setDismissedErrors] = useState(new Set());
  const retryTimeouts = useRef(new Map());

  // Error context and solutions database
  const errorSolutions = {
    [ERROR_TYPES.NETWORK]: {
      'Network connection failed': {
        solution: 'Check your internet connection and try again',
        action: 'Retry Connection',
        severity: ERROR_SEVERITY.HIGH,
        icon: '🌐',
        helpUrl: '/help/network-issues'
      },
      'RPC endpoint unavailable': {
        solution: 'Switch to a different RPC endpoint in your wallet settings',
        action: 'Switch Network',
        severity: ERROR_SEVERITY.MEDIUM,
        icon: '🔗',
        steps: [
          'Open your wallet settings',
          'Navigate to network settings',
          'Select a different RPC endpoint',
          'Try the transaction again'
        ]
      },
      'Network congestion': {
        solution: 'Network is congested. Increase gas price or wait for lower traffic',
        action: 'Increase Gas',
        severity: ERROR_SEVERITY.MEDIUM,
        icon: '🚦'
      }
    },
    [ERROR_TYPES.TRANSACTION]: {
      'Transaction failed': {
        solution: 'Transaction was reverted. Check your balance and try again',
        action: 'Retry Transaction',
        severity: ERROR_SEVERITY.MEDIUM,
        icon: '❌'
      },
      'Insufficient funds': {
        solution: 'You don\'t have enough funds to complete this transaction',
        action: 'Add Funds',
        severity: ERROR_SEVERITY.HIGH,
        icon: '💰',
        steps: [
          'Check your wallet balance',
          'Ensure you have enough for gas fees',
          'Add funds if needed',
          'Try the transaction again'
        ]
      },
      'Gas estimation failed': {
        solution: 'Unable to estimate gas. The transaction might fail',
        action: 'Set Gas Manually',
        severity: ERROR_SEVERITY.MEDIUM,
        icon: '⛽'
      },
      'Transaction timeout': {
        solution: 'Transaction took too long to confirm. It might still be pending',
        action: 'Check Status',
        severity: ERROR_SEVERITY.MEDIUM,
        icon: '⏱️'
      }
    },
    [ERROR_TYPES.WALLET]: {
      'Wallet not connected': {
        solution: 'Connect your wallet to continue',
        action: 'Connect Wallet',
        severity: ERROR_SEVERITY.HIGH,
        icon: '🔗'
      },
      'Wrong network': {
        solution: 'Switch to the correct network in your wallet',
        action: 'Switch Network',
        severity: ERROR_SEVERITY.HIGH,
        icon: '🔄',
        steps: [
          'Open your wallet',
          'Click on the network selector',
          'Select Polygon Mainnet',
          'Refresh the page'
        ]
      },
      'Transaction rejected': {
        solution: 'You rejected the transaction in your wallet',
        action: 'Try Again',
        severity: ERROR_SEVERITY.LOW,
        icon: '🚫'
      }
    },
    [ERROR_TYPES.CONTRACT]: {
      'Contract call failed': {
        solution: 'Smart contract interaction failed. Try again or contact support',
        action: 'Retry',
        severity: ERROR_SEVERITY.HIGH,
        icon: '📋'
      },
      'Invalid package tier': {
        solution: 'Selected package tier is not valid',
        action: 'Select Valid Package',
        severity: ERROR_SEVERITY.MEDIUM,
        icon: '📦'
      },
      'User already registered': {
        solution: 'This address is already registered in the system',
        action: 'Check Dashboard',
        severity: ERROR_SEVERITY.LOW,
        icon: '✅'
      }
    },
    [ERROR_TYPES.VALIDATION]: {
      'Invalid address': {
        solution: 'Enter a valid Ethereum address',
        action: 'Fix Address',
        severity: ERROR_SEVERITY.MEDIUM,
        icon: '📮'
      },
      'Amount too low': {
        solution: 'Minimum amount requirement not met',
        action: 'Increase Amount',
        severity: ERROR_SEVERITY.MEDIUM,
        icon: '💵'
      },
      'Required field missing': {
        solution: 'Please fill in all required fields',
        action: 'Complete Form',
        severity: ERROR_SEVERITY.MEDIUM,
        icon: '📝'
      }
    },
    [ERROR_TYPES.SYSTEM]: {
      'System maintenance': {
        solution: 'System is under maintenance. Please try again later',
        action: 'Try Later',
        severity: ERROR_SEVERITY.HIGH,
        icon: '🔧'
      },
      'Rate limit exceeded': {
        solution: 'Too many requests. Please wait and try again',
        action: 'Wait and Retry',
        severity: ERROR_SEVERITY.MEDIUM,
        icon: '⏳'
      }
    }
  };

  // Get error details with solution
  const getErrorDetails = useCallback((error) => {
    const { type, message, code, details } = error;
    
    // Find matching solution
    const typeSpecificSolutions = errorSolutions[type] || {};
    const matchingSolution = Object.entries(typeSpecificSolutions).find(([key]) => 
      message.toLowerCase().includes(key.toLowerCase())
    );

    const solution = matchingSolution?.[1] || {
      solution: 'An unexpected error occurred. Please try again or contact support',
      action: 'Retry',
      severity: ERROR_SEVERITY.MEDIUM,
      icon: '⚠️'
    };

    return {
      ...error,
      ...solution,
      id: error.id || `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: error.timestamp || Date.now()
    };
  }, []);

  // Handle retry with exponential backoff
  const handleRetry = useCallback(async (error) => {
    const errorId = error.id;
    const currentAttempts = retryAttempts.get(errorId) || 0;
    
    if (currentAttempts >= maxRetries) {
      console.warn(`Max retries (${maxRetries}) reached for error: ${error.message}`);
      return;
    }

    // Clear any existing timeout
    if (retryTimeouts.current.has(errorId)) {
      clearTimeout(retryTimeouts.current.get(errorId));
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, currentAttempts), 10000); // Max 10 seconds
    
    setRetryAttempts(prev => new Map(prev.set(errorId, currentAttempts + 1)));

    console.log(`Retrying in ${delay}ms (attempt ${currentAttempts + 1}/${maxRetries})`);

    const timeoutId = setTimeout(async () => {
      try {
        await onRetry?.(error);
        // Reset retry count on success
        setRetryAttempts(prev => {
          const newMap = new Map(prev);
          newMap.delete(errorId);
          return newMap;
        });
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
      
      retryTimeouts.current.delete(errorId);
    }, delay);

    retryTimeouts.current.set(errorId, timeoutId);
  }, [maxRetries, onRetry]);

  // Toggle error expansion for details
  const toggleErrorExpansion = useCallback((errorId) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(errorId)) {
        newSet.delete(errorId);
      } else {
        newSet.add(errorId);
      }
      return newSet;
    });
  }, []);

  // Dismiss error
  const dismissError = useCallback((error) => {
    setDismissedErrors(prev => new Set(prev.add(error.id)));
    onDismiss?.(error);
    
    // Clear any pending retry timeout
    if (retryTimeouts.current.has(error.id)) {
      clearTimeout(retryTimeouts.current.get(error.id));
      retryTimeouts.current.delete(error.id);
    }
  }, [onDismiss]);

  // Report error for analytics
  const reportError = useCallback((error) => {
    if (!enableErrorReporting) return;
    
    const errorReport = {
      ...error,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: Date.now(),
      retryAttempts: retryAttempts.get(error.id) || 0
    };
    
    onReportError?.(errorReport);
    console.log('Error reported:', errorReport);
  }, [enableErrorReporting, onReportError, retryAttempts]);

  // Get severity color class
  const getSeverityClass = useCallback((severity) => {
    switch (severity) {
      case ERROR_SEVERITY.LOW: return 'severity-low';
      case ERROR_SEVERITY.MEDIUM: return 'severity-medium';
      case ERROR_SEVERITY.HIGH: return 'severity-high';
      case ERROR_SEVERITY.CRITICAL: return 'severity-critical';
      default: return 'severity-medium';
    }
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      retryTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      retryTimeouts.current.clear();
    };
  }, []);

  // Filter out dismissed errors
  const visibleErrors = errors
    .map(getErrorDetails)
    .filter(error => !dismissedErrors.has(error.id));

  if (visibleErrors.length === 0) {
    return null;
  }

  return (
    <div className={`enhanced-error-feedback ${className}`} role="alert" aria-live="polite">
      {visibleErrors.map(error => {
        const isExpanded = expandedErrors.has(error.id);
        const attemptCount = retryAttempts.get(error.id) || 0;
        const canRetry = showRetryButton && attemptCount < maxRetries && onRetry;

        return (
          <div 
            key={error.id}
            className={`error-item ${getSeverityClass(error.severity)}`}
            role="alertdialog"
            aria-labelledby={`error-title-${error.id}`}
            aria-describedby={`error-description-${error.id}`}
          >
            {/* Error Header */}
            <div className="error-header">
              <div className="error-icon" role="img" aria-label={`${error.severity} severity error`}>
                {error.icon}
              </div>
              
              <div className="error-content">
                <h4 
                  id={`error-title-${error.id}`}
                  className="error-title"
                >
                  {error.message}
                </h4>
                
                {error.code && (
                  <span className="error-code">Code: {error.code}</span>
                )}
              </div>

              <div className="error-actions">
                <button
                  className="expand-button"
                  onClick={() => toggleErrorExpansion(error.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`error-details-${error.id}`}
                  title={isExpanded ? 'Hide details' : 'Show details'}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
                
                <button
                  className="dismiss-button"
                  onClick={() => dismissError(error)}
                  aria-label="Dismiss error"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Error Details */}
            {isExpanded && (
              <div 
                id={`error-details-${error.id}`}
                className="error-details"
                aria-hidden={!isExpanded}
              >
                <div 
                  id={`error-description-${error.id}`}
                  className="error-solution"
                >
                  <strong>Solution:</strong> {error.solution}
                </div>

                {error.steps && (
                  <div className="error-steps">
                    <strong>Steps to resolve:</strong>
                    <ol>
                      {error.steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {error.details && (
                  <div className="error-technical">
                    <strong>Technical details:</strong>
                    <pre>{JSON.stringify(error.details, null, 2)}</pre>
                  </div>
                )}

                {error.helpUrl && (
                  <div className="error-help">
                    <a 
                      href={error.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="help-link"
                    >
                      📚 More Help
                    </a>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="error-buttons">
                  {canRetry && (
                    <button
                      className="retry-button"
                      onClick={() => handleRetry(error)}
                      disabled={attemptCount >= maxRetries}
                    >
                      {attemptCount > 0 ? `Retry (${attemptCount}/${maxRetries})` : error.action}
                    </button>
                  )}
                  
                  <button
                    className="report-button"
                    onClick={() => reportError(error)}
                    title="Report this error"
                  >
                    📊 Report Issue
                  </button>
                </div>

                {attemptCount > 0 && (
                  <div className="retry-info">
                    Retry attempt {attemptCount} of {maxRetries}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Global Actions */}
      {visibleErrors.length > 1 && (
        <div className="global-actions">
          <button
            className="dismiss-all-button"
            onClick={() => visibleErrors.forEach(dismissError)}
          >
            Dismiss All ({visibleErrors.length})
          </button>
        </div>
      )}
    </div>
  );
};

export default EnhancedErrorFeedback;
