// NetworkStatusMonitor.jsx - Simple network status monitoring for demo
import React, { useState, useEffect } from 'react';
import './OrphiChainEnhanced.css';

const NetworkStatusMonitor = ({ 
  provider, 
  onStatusChange = () => {}, 
  onReconnect = () => {},
  pendingTransactions = []
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      onStatusChange({ isOnline: true, isProviderConnected: true });
      onReconnect();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      onStatusChange({ isOnline: false, isProviderConnected: false });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onStatusChange, onReconnect]);

  if (!isVisible) {
    return (
      <button
        className="floating-network-button"
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 999,
          background: isOnline ? 'var(--orphi-success-green)' : 'var(--orphi-alert-red)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          cursor: 'pointer',
          fontSize: '1.2rem'
        }}
        title={isOnline ? 'Network Online' : 'Network Offline'}
      >
        {isOnline ? '🟢' : '🔴'}
      </button>
    );
  }

  return (
    <div className="network-status-monitor bottom-left">
      <div className="status-header" onClick={() => setIsVisible(false)}>
        <div className={`status-icon ${isOnline ? 'status-online' : 'status-offline'}`}>
          {isOnline ? '✓' : '✕'}
        </div>
        <div className="status-text">
          {isOnline ? 'Network Online' : 'Network Offline'}
        </div>
        <button className="expand-button">×</button>
      </div>
      
      <div className="status-details">
        <div className="status-item">
          <span className="status-label">Connection:</span>
          <span className={`status-value ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        {pendingTransactions.length > 0 && (
          <div className="pending-transactions">
            <h4>Pending Transactions ({pendingTransactions.length})</h4>
            {pendingTransactions.slice(0, 3).map((tx, index) => (
              <div key={index} className="tx-item pending">
                <span className="tx-hash">{tx.id || 'Transaction'}</span>
                <span className="tx-status">Pending</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkStatusMonitor;
