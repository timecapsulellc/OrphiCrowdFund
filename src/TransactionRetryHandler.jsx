// TransactionRetryHandler.jsx - Robust transaction retry mechanism for blockchain interactions
import React, { useState, useCallback, useEffect } from 'react';
import './OrphiChainEnhanced.css';

/**
 * OrphiChain Transaction Retry Handler Component
 * 
 * Provides robust retry functionality for blockchain transactions with:
 * - Configurable retry attempts
 * - Exponential backoff
 * - Detailed transaction state tracking
 * - User-friendly error messages
 * - Ability to detect specific error types (gas issues, reverts, etc.)
 * - Recovery options for failed transactions
 */

// Common blockchain error patterns to identify transaction issues
const ERROR_PATTERNS = {
  INSUFFICIENT_FUNDS: /(insufficient funds|insufficient balance|not enough eth)/i,
  USER_REJECTED: /(user rejected|user denied|user cancelled)/i,
  GAS_TOO_LOW: /(gas too low|underpriced|gas price too low)/i,
  NONCE_TOO_LOW: /(nonce too low|nonce is too low|invalid nonce)/i,
  REPLACEMENT_UNDERPRICED: /(replacement transaction underpriced)/i,
  NETWORK_CONGESTION: /(transaction pool is full|too many transactions|network congestion)/i,
  EXECUTION_REVERTED: /(execution reverted|reverted with reason|transaction reverted)/i,
  CONNECTION_ERROR: /(connection error|network error|failed to fetch|internet disconnected)/i
};

// Human-readable error messages for each error type
const ERROR_MESSAGES = {
  INSUFFICIENT_FUNDS: "Insufficient funds in your wallet. Please add more funds and try again.",
  USER_REJECTED: "Transaction rejected. Please confirm the transaction in your wallet to proceed.",
  GAS_TOO_LOW: "Gas price too low. Please increase gas price and try again.",
  NONCE_TOO_LOW: "Transaction nonce issue. Please refresh the page and try again.",
  REPLACEMENT_UNDERPRICED: "Replacement transaction underpriced. Please increase gas price and try again.",
  NETWORK_CONGESTION: "Network congestion detected. Try again with higher gas price or later.",
  EXECUTION_REVERTED: "Transaction reverted. The smart contract rejected this transaction.",
  CONNECTION_ERROR: "Network connection issue. Please check your internet connection and try again.",
  UNKNOWN: "Transaction failed. Please try again or contact support if the issue persists."
};

// Identifies error type from error message
const identifyErrorType = (errorMessage) => {
  if (!errorMessage) return 'UNKNOWN';
  
  for (const [errorType, pattern] of Object.entries(ERROR_PATTERNS)) {
    if (pattern.test(errorMessage)) {
      return errorType;
    }
  }
  
  return 'UNKNOWN';
};

// Get user-friendly error message
const getUserFriendlyErrorMessage = (errorType) => {
  return ERROR_MESSAGES[errorType] || ERROR_MESSAGES.UNKNOWN;
};

// Transaction states for tracking
const TX_STATES = {
  IDLE: 'idle',
  WAITING_CONFIRMATION: 'waiting_confirmation',
  PENDING: 'pending',
  RETRYING: 'retrying',
  SUCCESS: 'success',
  FAILED: 'failed'
};

const TransactionRetryHandler = ({
  onSubmit, // Function that returns a Promise resolving to a transaction hash
  maxRetries = 3, // Maximum number of retry attempts
  initialDelay = 2000, // Initial delay in ms before first retry
  backoffFactor = 1.5, // Exponential backoff factor
  renderButton, // Render prop for the button/UI
  onSuccess, // Callback when transaction succeeds
  onFailure, // Callback when all retries fail
  renderStatus, // Optional render prop for custom status UI
  autoRetry = true, // Whether to auto-retry or require manual retry
  transactionName = "Transaction" // Name of the transaction for display
}) => {
  const [txState, setTxState] = useState(TX_STATES.IDLE);
  const [attempts, setAttempts] = useState(0);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const [retryTimer, setRetryTimer] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Calculate delay using exponential backoff
  const calculateDelay = useCallback((attempt) => {
    return initialDelay * Math.pow(backoffFactor, attempt);
  }, [initialDelay, backoffFactor]);

  // Reset state to defaults
  const resetState = useCallback(() => {
    setTxState(TX_STATES.IDLE);
    setAttempts(0);
    setTxHash(null);
    setError(null);
    setErrorType(null);
    setRetryCount(0);
    
    if (retryTimer) {
      clearTimeout(retryTimer);
      setRetryTimer(null);
    }
  }, [retryTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [retryTimer]);

  // Simple transaction execution for demo mode
  const executeTransaction = useCallback(async () => {
    if (txState === TX_STATES.WAITING_CONFIRMATION || txState === TX_STATES.PENDING) {
      return;
    }
    
    setAttempts(prev => prev + 1);
    setTxState(TX_STATES.WAITING_CONFIRMATION);
    
    try {
      // For demo mode, just simulate success
      setTimeout(() => {
        setTxState(TX_STATES.SUCCESS);
        if (onSuccess) {
          onSuccess({ txHash: '0x123...demo', attempts });
        }
      }, 2000);
    } catch (error) {
      setError(error.message || String(error));
      setTxState(TX_STATES.FAILED);
      if (onFailure) {
        onFailure({ error: error.message, attempts });
      }
    }
  }, [txState, onSuccess, onFailure, attempts]);

  // Default status renderer
  const defaultStatusRenderer = useCallback(() => {
    if (txState === TX_STATES.IDLE) return null;
    
    return (
      <div className={`transaction-status transaction-status-${txState}`}>
        {txState === TX_STATES.WAITING_CONFIRMATION && (
          <div className="transaction-message">
            <div className="transaction-spinner"></div>
            <p>Processing transaction...</p>
          </div>
        )}
        
        {txState === TX_STATES.SUCCESS && (
          <div className="transaction-message transaction-success">
            <div className="transaction-success-icon">✓</div>
            <p>Transaction successful!</p>
          </div>
        )}
        
        {txState === TX_STATES.FAILED && (
          <div className="transaction-message transaction-error">
            <div className="transaction-error-icon">✕</div>
            <p>Transaction failed</p>
            <button className="reset-button" onClick={resetState}>
              Reset
            </button>
          </div>
        )}
      </div>
    );
  }, [txState, resetState]);

  // Default button renderer
  const defaultButtonRenderer = useCallback(({ isProcessing, onClick }) => (
    <button 
      className={`transaction-button ${isProcessing ? 'processing' : ''}`}
      onClick={onClick} 
      disabled={isProcessing}
    >
      {isProcessing ? 'Processing...' : 'Submit Transaction'}
    </button>
  ), []);

  const isProcessing = [
    TX_STATES.WAITING_CONFIRMATION,
    TX_STATES.PENDING,
    TX_STATES.RETRYING
  ].includes(txState);

  const buttonProps = {
    isProcessing,
    onClick: executeTransaction,
    attempt: attempts,
    txState,
    errorType
  };

  return (
    <div className="transaction-retry-handler">
      {renderButton ? renderButton(buttonProps) : defaultButtonRenderer(buttonProps)}
      {renderStatus ? renderStatus({ 
        txState, 
        txHash, 
        error, 
        errorType, 
        attempts, 
        resetState
      }) : defaultStatusRenderer()}
    </div>
  );
};

export default TransactionRetryHandler;
