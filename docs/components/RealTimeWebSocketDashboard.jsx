import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';

/**
 * @title RealTimeWebSocketDashboard
 * @dev Enhanced real-time dashboard with WebSocket integration for V4UltraEnhanced contract
 * 
 * Features:
 * - WebSocket connections for instant updates
 * - Circuit breaker status monitoring
 * - Live distribution progress tracking
 * - System health monitoring
 * - Advanced performance metrics
 * - Real-time alerts and notifications
 */

const RealTimeWebSocketDashboard = ({ 
  contractAddress, 
  provider, 
  wsProvider, 
  userAddress,
  onAlert = () => {} 
}) => {
  // ===== REAL-TIME STATE =====
  const [realtimeData, setRealtimeData] = useState({
    systemHealth: {
      lastHealthCheck: 0,
      avgGasPerUser: 0,
      peakUsers: 0,
      totalDistributions: 0,
      healthStatus: true,
      performanceScore: 100
    },
    circuitBreaker: {
      failureCount: 0,
      lastFailureTime: 0,
      consecutiveSuccesses: 0,
      isTripped: false,
      autoRecoveryEnabled: true,
      lastRecoveryAttempt: 0,
      lastFailureReason: ""
    },
    distributionProgress: {
      processed: 0,
      total: 0,
      active: false,
      type: 0,
      gasUsed: 0,
      batchSize: 0
    },
    automationConfig: {
      enabled: false,
      maxUsersPerDistribution: 0,
      gasLimitConfig: 0,
      currentBatchSize: 0
    },
    liveEvents: [],
    connectionStatus: 'disconnected',
    lastUpdate: null
  });

  const [contract, setContract] = useState(null);
  const [wsContract, setWsContract] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const eventListenersRef = useRef(new Map());

  // ===== WEBSOCKET CONNECTION MANAGEMENT =====
  const connectWebSocket = useCallback(async () => {
    if (!wsProvider || !contractAddress) return;

    try {
      // Create WebSocket contract instance
      const contractInstance = new ethers.Contract(
        contractAddress,
        CONTRACT_ABI, // Define your contract ABI
        wsProvider
      );

      setWsContract(contractInstance);
      setRealtimeData(prev => ({ ...prev, connectionStatus: 'connected' }));

      // Set up real-time event listeners
      setupEventListeners(contractInstance);

      console.log('✅ WebSocket connected to V4UltraEnhanced contract');
      onAlert('WebSocket connected successfully', 'success');

    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      setRealtimeData(prev => ({ ...prev, connectionStatus: 'error' }));
      onAlert('WebSocket connection failed', 'error');
      
      // Attempt reconnection
      scheduleReconnect();
    }
  }, [wsProvider, contractAddress, onAlert]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('🔄 Attempting WebSocket reconnection...');
      connectWebSocket();
    }, 5000); // Reconnect after 5 seconds
  }, [connectWebSocket]);

  // ===== EVENT LISTENER SETUP =====
  const setupEventListeners = useCallback((contractInstance) => {
    // Clear existing listeners
    eventListenersRef.current.forEach((removeListener) => {
      removeListener();
    });
    eventListenersRef.current.clear();

    // Real-time events listener
    const handleRealTimeEvent = (eventType, data, timestamp, event) => {
      const realtimeEvent = {
        id: event.transactionHash,
        type: eventType,
        data: data,
        timestamp: Number(timestamp) * 1000,
        blockNumber: event.blockNumber,
        gasUsed: event.gasUsed || 0
      };

      setRealtimeData(prev => ({
        ...prev,
        liveEvents: [realtimeEvent, ...prev.liveEvents.slice(0, 99)], // Keep last 100 events
        lastUpdate: new Date()
      }));

      // Handle specific event types
      handleSpecificEvent(eventType, data, timestamp);
    };

    // Distribution progress events
    const handleDistributionStarted = (poolType, startId, endId, batchSize, timestamp, event) => {
      setRealtimeData(prev => ({
        ...prev,
        distributionProgress: {
          ...prev.distributionProgress,
          active: true,
          type: Number(poolType),
          processed: Number(startId),
          total: Number(endId),
          batchSize: Number(batchSize)
        }
      }));

      onAlert(`Distribution started: ${getPoolTypeName(Number(poolType))} Pool`, 'info');
    };

    const handleDistributionProgress = (poolType, processed, total, gasUsed, timestamp, event) => {
      setRealtimeData(prev => ({
        ...prev,
        distributionProgress: {
          ...prev.distributionProgress,
          processed: Number(processed),
          total: Number(total),
          gasUsed: Number(gasUsed)
        }
      }));
    };

    const handleDistributionCompleted = (poolType, amount, usersProcessed, totalGasUsed, timestamp, event) => {
      setRealtimeData(prev => ({
        ...prev,
        distributionProgress: {
          ...prev.distributionProgress,
          active: false,
          processed: 0,
          total: 0
        }
      }));

      const formattedAmount = ethers.formatEther(amount);
      onAlert(
        `Distribution completed: ${formattedAmount} USDT to ${usersProcessed} users`,
        'success'
      );
    };

    // Circuit breaker events
    const handleCircuitBreakerTripped = (reason, failureCount, timestamp, event) => {
      setRealtimeData(prev => ({
        ...prev,
        circuitBreaker: {
          ...prev.circuitBreaker,
          isTripped: true,
          failureCount: Number(failureCount),
          lastFailureTime: Number(timestamp) * 1000,
          lastFailureReason: reason
        }
      }));

      onAlert(`⚠️ Circuit breaker tripped: ${reason}`, 'error');
    };

    const handleCircuitBreakerRecovered = (downtime, timestamp, event) => {
      setRealtimeData(prev => ({
        ...prev,
        circuitBreaker: {
          ...prev.circuitBreaker,
          isTripped: false,
          consecutiveSuccesses: 0
        }
      }));

      const downtimeMinutes = Math.floor(Number(downtime) / 60);
      onAlert(`✅ Circuit breaker recovered after ${downtimeMinutes} minutes`, 'success');
    };

    // System health events
    const handleSystemHealthUpdate = (performanceScore, avgGasPerUser, healthStatus, timestamp, event) => {
      setRealtimeData(prev => ({
        ...prev,
        systemHealth: {
          ...prev.systemHealth,
          performanceScore: Number(performanceScore),
          avgGasPerUser: Number(avgGasPerUser),
          healthStatus: healthStatus,
          lastHealthCheck: Number(timestamp) * 1000
        }
      }));

      // Alert on health degradation
      if (Number(performanceScore) < 70) {
        onAlert(`⚠️ System health degraded: ${performanceScore}/100`, 'warning');
      }
    };

    // User registration events
    const handleUserRegistered = (user, id, sponsor, tier, event) => {
      const registrationEvent = {
        id: event.transactionHash,
        type: 'USER_REGISTERED',
        user: user,
        userId: Number(id),
        sponsor: sponsor,
        tier: Number(tier),
        timestamp: Date.now(),
        blockNumber: event.blockNumber
      };

      setRealtimeData(prev => ({
        ...prev,
        liveEvents: [registrationEvent, ...prev.liveEvents.slice(0, 99)]
      }));

      onAlert(`New user registered: #${Number(id)}`, 'info');
    };

    // Emergency mode events
    const handleEmergencyMode = (reason, timestamp, event, isActivated) => {
      const message = isActivated 
        ? `🚨 Emergency mode activated: ${reason}`
        : '✅ Emergency mode deactivated';
      
      onAlert(message, isActivated ? 'error' : 'success');
    };

    // Register all event listeners
    const listeners = [
      ['RealTimeEvent', handleRealTimeEvent],
      ['DistributionStarted', handleDistributionStarted],
      ['DistributionProgress', handleDistributionProgress],
      ['DistributionCompleted', handleDistributionCompleted],
      ['CircuitBreakerTripped', handleCircuitBreakerTripped],
      ['CircuitBreakerRecovered', handleCircuitBreakerRecovered],
      ['SystemHealthUpdate', handleSystemHealthUpdate],
      ['UserRegistered', handleUserRegistered],
      ['EmergencyModeActivated', (reason, timestamp, event) => handleEmergencyMode(reason, timestamp, event, true)],
      ['EmergencyModeDeactivated', (timestamp, event) => handleEmergencyMode('', timestamp, event, false)]
    ];

    listeners.forEach(([eventName, handler]) => {
      contractInstance.on(eventName, handler);
      eventListenersRef.current.set(eventName, () => contractInstance.off(eventName, handler));
    });

  }, [onAlert]);

  // ===== SPECIFIC EVENT HANDLING =====
  const handleSpecificEvent = useCallback((eventType, data, timestamp) => {
    switch (eventType) {
      case 'USER_REGISTERED':
        // Refresh user count
        loadSystemStats();
        break;
      
      case 'AUTOMATION_FAILURE':
        const [reason, failureCount] = ethers.AbiCoder.defaultAbiCoder().decode(['string', 'uint256'], data);
        onAlert(`Automation failure: ${reason} (${failureCount} failures)`, 'warning');
        break;
      
      case 'CIRCUIT_BREAKER_TRIPPED':
        const [cbReason, cbFailureCount] = ethers.AbiCoder.defaultAbiCoder().decode(['string', 'uint256'], data);
        setRealtimeData(prev => ({
          ...prev,
          circuitBreaker: {
            ...prev.circuitBreaker,
            isTripped: true,
            failureCount: Number(cbFailureCount),
            lastFailureReason: cbReason
          }
        }));
        break;
      
      case 'HEALTH_CHECK':
        const [score, avgGas, healthStatus] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256', 'bool'], data);
        setRealtimeData(prev => ({
          ...prev,
          systemHealth: {
            ...prev.systemHealth,
            performanceScore: Number(score),
            avgGasPerUser: Number(avgGas),
            healthStatus: healthStatus
          }
        }));
        break;
      
      case 'CONFIG_UPDATED':
        const [gasLimit, maxUsers] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', 'uint32'], data);
        setRealtimeData(prev => ({
          ...prev,
          automationConfig: {
            ...prev.automationConfig,
            gasLimitConfig: Number(gasLimit),
            maxUsersPerDistribution: Number(maxUsers)
          }
        }));
        onAlert('Automation configuration updated', 'info');
        break;

      default:
        console.log(`📊 Real-time event: ${eventType}`, data);
    }
  }, [onAlert]);

  // ===== DATA LOADING FUNCTIONS =====
  const loadSystemStats = useCallback(async () => {
    if (!contract) return;

    try {
      const [health, circuitBreakerStatus, automationConfig, progress] = await Promise.all([
        contract.getSystemHealth(),
        contract.getCircuitBreakerStatus(),
        contract.getAutomationConfig(),
        contract.getDistributionProgress()
      ]);

      setRealtimeData(prev => ({
        ...prev,
        systemHealth: {
          lastHealthCheck: Number(health.lastHealthCheck) * 1000,
          avgGasPerUser: Number(health.avgGasPerUser),
          peakUsers: Number(health.peakUsers),
          totalDistributions: Number(health.totalDistributions),
          healthStatus: health.healthStatus,
          performanceScore: Number(health.performanceScore)
        },
        circuitBreaker: {
          failureCount: Number(circuitBreakerStatus.failureCount),
          lastFailureTime: Number(circuitBreakerStatus.lastFailureTime) * 1000,
          consecutiveSuccesses: Number(circuitBreakerStatus.consecutiveSuccesses),
          isTripped: circuitBreakerStatus.isTripped,
          autoRecoveryEnabled: circuitBreakerStatus.autoRecoveryEnabled,
          lastRecoveryAttempt: Number(circuitBreakerStatus.lastRecoveryAttempt) * 1000,
          lastFailureReason: circuitBreakerStatus.lastFailureReason
        },
        automationConfig: {
          enabled: automationConfig.enabled,
          maxUsersPerDistribution: Number(automationConfig.maxUsersPerDistribution),
          gasLimitConfig: Number(automationConfig.gasLimitConfig),
          currentBatchSize: Number(automationConfig.currentBatchSize)
        },
        distributionProgress: {
          processed: Number(progress.processed),
          total: Number(progress.total),
          active: progress.active
        },
        lastUpdate: new Date()
      }));

    } catch (error) {
      console.error('Error loading system stats:', error);
      onAlert('Failed to load system statistics', 'error');
    }
  }, [contract, onAlert]);

  // ===== UTILITY FUNCTIONS =====
  const getPoolTypeName = (poolType) => {
    switch (poolType) {
      case 1: return 'GHP';
      case 2: return 'Leader';
      default: return 'Unknown';
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatGas = (gas) => {
    return (gas / 1000).toFixed(1) + 'K';
  };

  // ===== EFFECTS =====
  useEffect(() => {
    if (provider && contractAddress) {
      const contractInstance = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
      setContract(contractInstance);
    }
  }, [provider, contractAddress]);

  useEffect(() => {
    if (wsProvider && contractAddress) {
      connectWebSocket();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      eventListenersRef.current.forEach((removeListener) => {
        removeListener();
      });
    };
  }, [wsProvider, contractAddress, connectWebSocket]);

  useEffect(() => {
    if (contract) {
      loadSystemStats();
      const interval = setInterval(loadSystemStats, 60000); // Backup polling every minute
      return () => clearInterval(interval);
    }
  }, [contract, loadSystemStats]);

  // ===== RENDER =====
  return (
    <div className="realtime-dashboard">
      {/* Connection Status */}
      <div className={`connection-status ${realtimeData.connectionStatus}`}>
        <div className="status-indicator">
          <span className={`status-dot ${realtimeData.connectionStatus}`}></span>
          <span className="status-text">
            {realtimeData.connectionStatus === 'connected' ? 'Live' : 
             realtimeData.connectionStatus === 'error' ? 'Disconnected' : 'Connecting...'}
          </span>
          {realtimeData.lastUpdate && (
            <span className="last-update">
              Last update: {formatTimestamp(realtimeData.lastUpdate)}
            </span>
          )}
        </div>
      </div>

      {/* System Health Dashboard */}
      <div className="system-health-card">
        <h3>🏥 System Health</h3>
        <div className="health-metrics">
          <div className="metric">
            <span className="metric-label">Performance Score</span>
            <span className={`metric-value ${realtimeData.systemHealth.performanceScore >= 80 ? 'good' : 
                                             realtimeData.systemHealth.performanceScore >= 60 ? 'warning' : 'critical'}`}>
              {realtimeData.systemHealth.performanceScore}/100
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Avg Gas/User</span>
            <span className="metric-value">{formatGas(realtimeData.systemHealth.avgGasPerUser)}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Peak Users</span>
            <span className="metric-value">{realtimeData.systemHealth.peakUsers.toLocaleString()}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Total Distributions</span>
            <span className="metric-value">{realtimeData.systemHealth.totalDistributions}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Status</span>
            <span className={`metric-value ${realtimeData.systemHealth.healthStatus ? 'healthy' : 'unhealthy'}`}>
              {realtimeData.systemHealth.healthStatus ? '✅ Healthy' : '⚠️ Issues'}
            </span>
          </div>
        </div>
      </div>

      {/* Circuit Breaker Status */}
      <div className={`circuit-breaker-card ${realtimeData.circuitBreaker.isTripped ? 'tripped' : 'normal'}`}>
        <h3>⚡ Circuit Breaker</h3>
        <div className="circuit-breaker-status">
          <div className="status-indicator">
            <span className={`status-light ${realtimeData.circuitBreaker.isTripped ? 'red' : 'green'}`}></span>
            <span className="status-text">
              {realtimeData.circuitBreaker.isTripped ? 'TRIPPED' : 'NORMAL'}
            </span>
          </div>
          
          <div className="breaker-metrics">
            <div className="metric">
              <span className="metric-label">Failure Count</span>
              <span className="metric-value">{realtimeData.circuitBreaker.failureCount}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Consecutive Successes</span>
              <span className="metric-value">{realtimeData.circuitBreaker.consecutiveSuccesses}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Auto Recovery</span>
              <span className="metric-value">
                {realtimeData.circuitBreaker.autoRecoveryEnabled ? '✅ Enabled' : '❌ Disabled'}
              </span>
            </div>
          </div>

          {realtimeData.circuitBreaker.lastFailureReason && (
            <div className="last-failure">
              <strong>Last Failure:</strong> {realtimeData.circuitBreaker.lastFailureReason}
              <br />
              <small>{formatTimestamp(realtimeData.circuitBreaker.lastFailureTime)}</small>
            </div>
          )}
        </div>
      </div>

      {/* Distribution Progress */}
      {realtimeData.distributionProgress.active && (
        <div className="distribution-progress-card">
          <h3>📊 Distribution in Progress</h3>
          <div className="progress-info">
            <div className="progress-header">
              <span className="pool-type">
                {getPoolTypeName(realtimeData.distributionProgress.type)} Pool Distribution
              </span>
              <span className="progress-percentage">
                {((realtimeData.distributionProgress.processed / realtimeData.distributionProgress.total) * 100).toFixed(1)}%
              </span>
            </div>
            
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ 
                  width: `${(realtimeData.distributionProgress.processed / realtimeData.distributionProgress.total) * 100}%` 
                }}
              ></div>
            </div>
            
            <div className="progress-details">
              <span>
                {realtimeData.distributionProgress.processed.toLocaleString()} / {realtimeData.distributionProgress.total.toLocaleString()} users
              </span>
              {realtimeData.distributionProgress.gasUsed > 0 && (
                <span>Gas used: {formatGas(realtimeData.distributionProgress.gasUsed)}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Automation Configuration */}
      <div className="automation-config-card">
        <h3>🤖 Automation Config</h3>
        <div className="config-metrics">
          <div className="metric">
            <span className="metric-label">Status</span>
            <span className={`metric-value ${realtimeData.automationConfig.enabled ? 'enabled' : 'disabled'}`}>
              {realtimeData.automationConfig.enabled ? '✅ Enabled' : '❌ Disabled'}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Max Users/Batch</span>
            <span className="metric-value">{realtimeData.automationConfig.maxUsersPerDistribution}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Current Batch Size</span>
            <span className="metric-value">{realtimeData.automationConfig.currentBatchSize}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Gas Limit</span>
            <span className="metric-value">{formatGas(realtimeData.automationConfig.gasLimitConfig)}</span>
          </div>
        </div>
      </div>

      {/* Live Events Feed */}
      <div className="live-events-card">
        <h3>📡 Live Events</h3>
        <div className="events-feed">
          {realtimeData.liveEvents.slice(0, 10).map((event, index) => (
            <div key={event.id || index} className={`event-item ${event.type.toLowerCase()}`}>
              <div className="event-header">
                <span className="event-type">{event.type.replace(/_/g, ' ')}</span>
                <span className="event-time">{formatTimestamp(event.timestamp)}</span>
              </div>
              <div className="event-details">
                {event.type === 'USER_REGISTERED' && (
                  <span>User #{event.userId} registered (Tier {event.tier})</span>
                )}
                {event.type === 'WITHDRAWAL' && (
                  <span>Withdrawal: {ethers.formatEther(event.data)} USDT</span>
                )}
                {event.type === 'AUTOMATION_FAILURE' && (
                  <span>Automation failure detected</span>
                )}
                {event.type === 'HEALTH_CHECK' && (
                  <span>System health check completed</span>
                )}
                {event.blockNumber && (
                  <small className="block-number">Block #{event.blockNumber}</small>
                )}
              </div>
            </div>
          ))}
          
          {realtimeData.liveEvents.length === 0 && (
            <div className="no-events">
              <span>No recent events</span>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .realtime-dashboard {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .connection-status {
          grid-column: 1 / -1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 20px;
          border-radius: 8px;
          margin-bottom: 10px;
        }

        .connection-status.connected {
          background: rgba(76, 175, 80, 0.1);
          border: 1px solid #4CAF50;
        }

        .connection-status.error {
          background: rgba(244, 67, 54, 0.1);
          border: 1px solid #F44336;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .status-dot.connected {
          background: #4CAF50;
        }

        .status-dot.error {
          background: #F44336;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        .system-health-card, .circuit-breaker-card, .distribution-progress-card, 
        .automation-config-card, .live-events-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
          backdrop-filter: blur(10px);
        }

        .circuit-breaker-card.tripped {
          border-color: #F44336;
          background: rgba(244, 67, 54, 0.1);
        }

        .health-metrics, .config-metrics, .breaker-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }

        .metric {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .metric-label {
          font-size: 0.9em;
          opacity: 0.7;
        }

        .metric-value {
          font-size: 1.2em;
          font-weight: bold;
        }

        .metric-value.good { color: #4CAF50; }
        .metric-value.warning { color: #FF9800; }
        .metric-value.critical { color: #F44336; }
        .metric-value.healthy { color: #4CAF50; }
        .metric-value.unhealthy { color: #F44336; }
        .metric-value.enabled { color: #4CAF50; }
        .metric-value.disabled { color: #F44336; }

        .progress-bar {
          width: 100%;
          height: 20px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          overflow: hidden;
          margin: 10px 0;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #00D4FF, #7B2CBF);
          transition: width 0.3s ease;
        }

        .events-feed {
          max-height: 400px;
          overflow-y: auto;
          margin-top: 15px;
        }

        .event-item {
          padding: 10px;
          border-left: 3px solid #00D4FF;
          margin-bottom: 10px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 0 8px 8px 0;
        }

        .event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 5px;
        }

        .event-type {
          font-weight: bold;
          text-transform: capitalize;
        }

        .event-time {
          font-size: 0.8em;
          opacity: 0.7;
        }

        .distribution-progress-card {
          grid-column: 1 / -1;
        }

        .live-events-card {
          grid-column: 1 / -1;
        }

        @media (max-width: 768px) {
          .realtime-dashboard {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

// Minimal contract ABI for the events we need
const CONTRACT_ABI = [
  "event RealTimeEvent(string eventType, bytes data, uint256 timestamp)",
  "event DistributionStarted(uint8 poolType, uint32 startId, uint32 endId, uint256 batchSize, uint256 timestamp)",
  "event DistributionProgress(uint8 poolType, uint32 processed, uint32 total, uint256 gasUsed, uint256 timestamp)",
  "event DistributionCompleted(uint8 poolType, uint256 amount, uint32 usersProcessed, uint256 totalGasUsed, uint256 timestamp)",
  "event CircuitBreakerTripped(string reason, uint256 failureCount, uint256 timestamp)",
  "event CircuitBreakerRecovered(uint256 downtime, uint256 timestamp)",
  "event SystemHealthUpdate(uint256 performanceScore, uint256 avgGasPerUser, bool healthStatus, uint256 timestamp)",
  "event UserRegistered(address indexed user, uint32 indexed id, address indexed sponsor, uint16 tier)",
  "event EmergencyModeActivated(string reason, uint256 timestamp)",
  "event EmergencyModeDeactivated(uint256 timestamp)",
  "function getSystemHealth() view returns (tuple(uint256 lastHealthCheck, uint256 avgGasPerUser, uint256 peakUsers, uint256 totalDistributions, bool healthStatus, uint256 performanceScore))",
  "function getCircuitBreakerStatus() view returns (tuple(uint256 failureCount, uint256 lastFailureTime, uint256 consecutiveSuccesses, bool isTripped, bool autoRecoveryEnabled, uint256 lastRecoveryAttempt, string lastFailureReason))",
  "function getAutomationConfig() view returns (tuple(bool enabled, uint32 maxUsersPerDistribution, uint32 lastProcessedId, uint32 currentBatchSize, bool isDistributing, uint8 distributionType, uint256 gasLimitConfig))",
  "function getDistributionProgress() view returns (uint32 processed, uint32 total, bool active)"
];

export default RealTimeWebSocketDashboard;
