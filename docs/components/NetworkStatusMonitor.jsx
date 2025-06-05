// NetworkStatusMonitor.jsx - Detects and handles network connectivity issues
import React, { useState, useEffect, useCallback } from 'react';
import './OrphiChainEnhanced.css';

/**
 * OrphiChain Network Status Monitor Component
 * 
 * Monitors network connectivity and blockchain provider status:
 * - Detects internet connection loss
 * - Monitors blockchain provider connection
 * - Automatically reconnects when network is restored
 * - Provides visual feedback on connection status
 * - Handles transaction resumption after reconnection
 * 
 * Usage example:
 * 
 * ```jsx
 * <NetworkStatusMonitor
 *   provider={ethersProvider}
 *   onStatusChange={(status) => console.log('Network status:', status)}
 *   pendingTransactions={pendingTxList}
 * />
 * ```
 */

// Network status states
const NETWORK_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  RECONNECTING: 'reconnecting',
  PROVIDER_ERROR: 'provider_error',
  BLOCKCHAIN_CONGESTED: 'blockchain_congested',
  SYNCING: 'syncing'
};

const NetworkStatusMonitor = ({
  provider, // ethers provider
  checkInterval = 10000, // How often to check network in ms
  maxReconnectAttempts = 5, // Maximum reconnection attempts
  reconnectDelay = 3000, // Delay between reconnection attempts
  onStatusChange, // Callback when network status changes
  pendingTransactions = [], // Array of pending transactions to monitor
  onTransactionsRecovered, // Callback when pending transactions are recovered
  minimized = false, // Whether to show minimized version
  position = 'bottom-right', // Position on screen
  networkName = 'BSC', // Name of the blockchain network
  customEndpoint = null, // Custom RPC endpoint to check
}) => {
  const [networkStatus, setNetworkStatus] = useState(navigator.onLine ? NETWORK_STATUS.ONLINE : NETWORK_STATUS.OFFLINE);
  const [providerConnected, setProviderConnected] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastBlockTime, setLastBlockTime] = useState(Date.now());
  const [isExpanded, setIsExpanded] = useState(false);
  const [blockDelay, setBlockDelay] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [recoveredTxs, setRecoveredTxs] = useState([]);
  const [networkLatency, setNetworkLatency] = useState(null);

  // Check if provider is connected
  const checkProviderConnection = useCallback(async () => {
    if (!provider) return true;
    
    try {
      // Check if we can get network information
      const startTime = performance.now();
      const network = await provider.getNetwork();
      const endTime = performance.now();
      
      // Calculate and update network latency
      const latency = Math.round(endTime - startTime);
      setNetworkLatency(latency);
      
      // If network has changed, show warning
      if (network && network.chainId && window.lastKnownChainId && network.chainId !== window.lastKnownChainId) {
        setIsVisible(true);
        return false;
      }
      
      // Store the current chain ID
      if (network && network.chainId) {
        window.lastKnownChainId = network.chainId;
      }
      
      return true;
    } catch (error) {
      console.error('Provider connection check failed:', error);
      return false;
    }
  }, [provider]);

  // Check for blockchain congestion by monitoring block time
  const checkBlockchainStatus = useCallback(async () => {
    if (!provider) return true;
    
    try {
      // Get current block
      const currentBlock = await provider.getBlock('latest');
      
      if (currentBlock && currentBlock.timestamp) {
        const currentBlockTime = currentBlock.timestamp * 1000; // Convert to ms
        const now = Date.now();
        const delay = now - currentBlockTime;
        
        setBlockDelay(delay / 1000); // Convert to seconds
        
        // If block is older than 1 minute, consider the blockchain congested
        if (delay > 60000) {
          return false;
        }
        
        setLastBlockTime(currentBlockTime);
      }
      
      return true;
    } catch (error) {
      console.error('Blockchain status check failed:', error);
      return true; // Don't trigger congestion on error
    }
  }, [provider]);

  // Recover pending transactions after reconnection
  const recoverPendingTransactions = useCallback(async () => {
    if (!provider || pendingTransactions.length === 0) return;
    
    const recovered = [];
    
    for (const tx of pendingTransactions) {
      try {
        // Check transaction receipt
        const receipt = await provider.getTransactionReceipt(tx.hash);
        
        if (receipt) {
          recovered.push({
            ...tx,
            status: receipt.status ? 'confirmed' : 'failed',
            receipt
          });
        } else {
          // Transaction not yet mined, check if it's still in mempool
          const transaction = await provider.getTransaction(tx.hash);
          
          if (transaction) {
            recovered.push({
              ...tx,
              status: 'pending',
              transaction
            });
          } else {
            // Transaction not found, mark as lost
            recovered.push({
              ...tx,
              status: 'lost',
              canResubmit: true
            });
          }
        }
      } catch (error) {
        console.error(`Error recovering transaction ${tx.hash}:`, error);
        recovered.push({
          ...tx,
          status: 'error',
          error: error.message
        });
      }
    }
    
    setRecoveredTxs(recovered);
    
    if (onTransactionsRecovered && recovered.length > 0) {
      onTransactionsRecovered(recovered);
    }
  }, [provider, pendingTransactions, onTransactionsRecovered]);

  // Handle reconnection attempts
  const attemptReconnect = useCallback(async () => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      setNetworkStatus(NETWORK_STATUS.PROVIDER_ERROR);
      return false;
    }
    
    setNetworkStatus(NETWORK_STATUS.RECONNECTING);
    setReconnectAttempts(prev => prev + 1);
    
    try {
      // Check custom endpoint if provided
      if (customEndpoint) {
        const response = await fetch(customEndpoint, { method: 'HEAD' });
        if (!response.ok) throw new Error('Custom endpoint unreachable');
      }
      
      // Check provider connection
      const isProviderConnected = await checkProviderConnection();
      if (!isProviderConnected) throw new Error('Provider connection failed');
      
      // Check blockchain status
      const isBlockchainNormal = await checkBlockchainStatus();
      
      if (!isBlockchainNormal) {
        setNetworkStatus(NETWORK_STATUS.BLOCKCHAIN_CONGESTED);
        return false;
      }
      
      // All checks passed, mark as online
      setNetworkStatus(NETWORK_STATUS.ONLINE);
      setProviderConnected(true);
      setReconnectAttempts(0);
      setIsVisible(false);
      
      // Recover pending transactions
      await recoverPendingTransactions();
      
      return true;
    } catch (error) {
      console.error('Reconnection attempt failed:', error);
      
      // Schedule next reconnection attempt
      setTimeout(attemptReconnect, reconnectDelay);
      return false;
    }
  }, [
    reconnectAttempts,
    maxReconnectAttempts,
    customEndpoint,
    checkProviderConnection,
    checkBlockchainStatus,
    reconnectDelay,
    recoverPendingTransactions
  ]);

  // Handle online/offline status changes
  useEffect(() => {
    const handleOnline = () => {
      if (networkStatus !== NETWORK_STATUS.ONLINE) {
        attemptReconnect();
      }
    };
    
    const handleOffline = () => {
      setNetworkStatus(NETWORK_STATUS.OFFLINE);
      setProviderConnected(false);
      setIsVisible(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [networkStatus, attemptReconnect]);

  // Periodic check for provider connection and blockchain status
  useEffect(() => {
    const checkConnection = async () => {
      // Skip if already offline or reconnecting
      if (networkStatus === NETWORK_STATUS.OFFLINE || 
          networkStatus === NETWORK_STATUS.RECONNECTING) {
        return;
      }
      
      // Check if provider is connected
      const isProviderConnected = await checkProviderConnection();
      setProviderConnected(isProviderConnected);
      
      if (!isProviderConnected) {
        setNetworkStatus(NETWORK_STATUS.PROVIDER_ERROR);
        setIsVisible(true);
        attemptReconnect();
        return;
      }
      
      // Check blockchain status
      const isBlockchainNormal = await checkBlockchainStatus();
      
      if (!isBlockchainNormal) {
        setNetworkStatus(NETWORK_STATUS.BLOCKCHAIN_CONGESTED);
        setIsVisible(true);
        return;
      }
      
      // All checks passed, mark as online
      if (networkStatus !== NETWORK_STATUS.ONLINE) {
        setNetworkStatus(NETWORK_STATUS.ONLINE);
        setIsVisible(false);
      }
    };
    
    // Initial check
    checkConnection();
    
    // Set up interval for periodic checks
    const interval = setInterval(checkConnection, checkInterval);
    
    return () => clearInterval(interval);
  }, [
    networkStatus,
    checkInterval,
    checkProviderConnection,
    checkBlockchainStatus,
    attemptReconnect
  ]);

  // Notify on status change
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(networkStatus);
    }
  }, [networkStatus, onStatusChange]);

  // Listen for new blocks to update lastBlockTime
  useEffect(() => {
    if (!provider) return;
    
    const handleNewBlock = (blockNumber) => {
      provider.getBlock(blockNumber).then(block => {
        if (block && block.timestamp) {
          setLastBlockTime(block.timestamp * 1000);
        }
      });
    };
    
    provider.on('block', handleNewBlock);
    
    return () => {
      provider.removeListener('block', handleNewBlock);
    };
  }, [provider]);

  // Force visible when status is not online
  useEffect(() => {
    if (networkStatus !== NETWORK_STATUS.ONLINE) {
      setIsVisible(true);
    }
  }, [networkStatus]);

  // Get status text and icon based on network status
  const getStatusInfo = () => {
    switch (networkStatus) {
      case NETWORK_STATUS.ONLINE:
        return {
          text: `Connected to ${networkName}`,
          icon: '✓',
          className: 'status-online'
        };
      case NETWORK_STATUS.OFFLINE:
        return {
          text: 'Internet Disconnected',
          icon: '✕',
          className: 'status-offline'
        };
      case NETWORK_STATUS.RECONNECTING:
        return {
          text: `Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})...`,
          icon: '↻',
          className: 'status-reconnecting'
        };
      case NETWORK_STATUS.PROVIDER_ERROR:
        return {
          text: `${networkName} Provider Error`,
          icon: '⚠',
          className: 'status-provider-error'
        };
      case NETWORK_STATUS.BLOCKCHAIN_CONGESTED:
        return {
          text: `${networkName} Network Congested`,
          icon: '⚠',
          className: 'status-congested'
        };
      case NETWORK_STATUS.SYNCING:
        return {
          text: 'Syncing Blockchain Data...',
          icon: '↻',
          className: 'status-syncing'
        };
      default:
        return {
          text: 'Checking Connection...',
          icon: '?',
          className: 'status-unknown'
        };
    }
  };

  const statusInfo = getStatusInfo();

  // Don't render anything if status is online and minimized
  if (networkStatus === NETWORK_STATUS.ONLINE && !isVisible && minimized) {
    return null;
  }

  return (
    <div className={`network-status-monitor ${position} ${isExpanded ? 'expanded' : 'collapsed'} ${statusInfo.className}`}>
      <div className="status-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="status-icon">{statusInfo.icon}</div>
        <div className="status-text">{statusInfo.text}</div>
        <div className="status-indicator"></div>
        {networkLatency !== null && networkStatus === NETWORK_STATUS.ONLINE && (
          <div className="network-latency" title="Network response time">
            {networkLatency}ms
          </div>
        )}
        <button className="expand-button">{isExpanded ? '▼' : '▲'}</button>
      </div>
      
      {isExpanded && (
        <div className="status-details">
          <div className="status-item">
            <span className="status-label">Internet:</span>
            <span className={`status-value ${navigator.onLine ? 'online' : 'offline'}`}>
              {navigator.onLine ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <div className="status-item">
            <span className="status-label">Provider:</span>
            <span className={`status-value ${providerConnected ? 'online' : 'offline'}`}>
              {providerConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <div className="status-item">
            <span className="status-label">Network:</span>
            <span className="status-value">{networkName}</span>
          </div>
          
          <div className="status-item">
            <span className="status-label">Last Block:</span>
            <span className="status-value">
              {lastBlockTime ? `${Math.round(blockDelay)}s ago` : 'Unknown'}
            </span>
          </div>
          
          {pendingTransactions.length > 0 && (
            <div className="pending-transactions">
              <h4>Pending Transactions ({pendingTransactions.length})</h4>
              <ul>
                {pendingTransactions.map((tx, index) => (
                  <li key={tx.hash || index} className={`tx-item ${tx.status || 'pending'}`}>
                    <span className="tx-hash">{tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}</span>
                    <span className="tx-status">{tx.status || 'pending'}</span>
                    <a 
                      href={`https://bscscan.com/tx/${tx.hash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="tx-link"
                    >
                      View
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {recoveredTxs.length > 0 && (
            <div className="recovered-transactions">
              <h4>Recovered Transactions ({recoveredTxs.length})</h4>
              <ul>
                {recoveredTxs.map((tx, index) => (
                  <li key={tx.hash || index} className={`tx-item ${tx.status}`}>
                    <span className="tx-hash">{tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}</span>
                    <span className="tx-status">{tx.status}</span>
                    {tx.canResubmit && (
                      <button className="resubmit-button">Resubmit</button>
                    )}
                    <a 
                      href={`https://bscscan.com/tx/${tx.hash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="tx-link"
                    >
                      View
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {networkStatus !== NETWORK_STATUS.ONLINE && (
            <button 
              className="reconnect-button"
              onClick={attemptReconnect}
              disabled={networkStatus === NETWORK_STATUS.RECONNECTING}
            >
              {networkStatus === NETWORK_STATUS.RECONNECTING ? 'Reconnecting...' : 'Reconnect Now'}
            </button>
          )}
          
          <button className="close-button" onClick={() => setIsVisible(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default NetworkStatusMonitor;
