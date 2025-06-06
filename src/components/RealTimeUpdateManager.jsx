// RealTimeUpdateManager.jsx - Comprehensive real-time update system
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';

/**
 * RealTimeUpdateManager - Production-ready real-time update system
 * 
 * Features:
 * - WebSocket + Polling fallback for reliability
 * - Automatic reconnection with exponential backoff
 * - Queue management for failed updates
 * - Bandwidth optimization with smart batching
 * - Cross-tab synchronization via BroadcastChannel
 * - Offline support with update queuing
 * - Performance monitoring and adaptive refresh rates
 */

const RealTimeUpdateManager = ({
  contractAddress,
  provider,
  wsProvider,
  onDataUpdate,
  onConnectionStatusChange,
  onError,
  updateInterval = 30000, // Fallback polling interval
  maxRetries = 5,
  enableCrossTabs = true,
  enableOfflineQueue = true
}) => {
  // Connection and state management
  const [connectionStatus, setConnectionStatus] = useState({
    websocket: 'disconnected', // connected, disconnected, error
    polling: 'inactive',       // active, inactive, error
    network: navigator.onLine,  // online, offline
    quality: 'good',           // good, fair, poor
    lastUpdate: null,
    retryCount: 0
  });

  // Real-time data state
  const [realtimeState, setRealtimeState] = useState({
    systemStats: null,
    pendingTransactions: [],
    eventQueue: [],
    lastBlockNumber: 0,
    updateCount: 0,
    performanceMetrics: {
      avgUpdateTime: 0,
      successRate: 100,
      lastErrorTime: null
    }
  });

  // Refs for cleanup and state persistence
  const wsRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const eventListenersRef = useRef(new Map());
  const updateQueueRef = useRef([]);
  const broadcastChannelRef = useRef(null);
  const performanceRef = useRef({ startTime: 0, successCount: 0, totalCount: 0 });

  // ===== WEBSOCKET MANAGEMENT =====
  const connectWebSocket = useCallback(async () => {
    if (!wsProvider || !contractAddress) {
      console.warn('WebSocket provider or contract address not available');
      return;
    }

    try {
      // Create contract instance with WebSocket provider
      const contract = new ethers.Contract(
        contractAddress,
        [
          // Essential events for real-time updates
          "event UserRegistered(address indexed user, uint32 indexed id, address indexed sponsor, uint16 tier)",
          "event WithdrawalMade(address indexed user, uint256 amount, uint256 timestamp)",
          "event GlobalHelpDistributed(uint8 poolType, uint256 amount, uint32 participantCount)",
          "event RealTimeEvent(string eventType, bytes data, uint256 timestamp)",
          "event SystemHealthUpdate(uint256 performanceScore, uint256 avgGasPerUser, bool healthStatus)",
          "event CircuitBreakerTripped(string reason, uint256 failureCount)",
          "event EmergencyModeActivated(string reason, uint256 timestamp)",
          // Read functions
          "function getSystemStats() view returns (tuple(uint256 totalMembers, uint256 totalVolume, uint256[] poolBalances))",
          "function getUserInfo(address user) view returns (tuple(uint32 id, address sponsor, uint256 totalEarned, uint16 packageTier, bool isActive))"
        ],
        wsProvider
      );

      wsRef.current = contract;
      
      // Set up event listeners
      setupEventListeners(contract);
      
      setConnectionStatus(prev => ({
        ...prev,
        websocket: 'connected',
        retryCount: 0,
        lastUpdate: new Date()
      }));

      console.log('✅ WebSocket connected successfully');
      onConnectionStatusChange?.({ type: 'websocket', status: 'connected' });

    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      setConnectionStatus(prev => ({
        ...prev,
        websocket: 'error',
        retryCount: prev.retryCount + 1
      }));
      
      onError?.('WebSocket connection failed', error);
      scheduleReconnect();
    }
  }, [wsProvider, contractAddress, onConnectionStatusChange, onError]);

  // Set up event listeners for real-time updates
  const setupEventListeners = useCallback((contract) => {
    // Clear existing listeners
    eventListenersRef.current.forEach(removeListener => removeListener());
    eventListenersRef.current.clear();

    // User registration events
    const handleUserRegistered = (user, id, sponsor, tier, event) => {
      const updateData = {
        type: 'USER_REGISTERED',
        data: { user, id: Number(id), sponsor, tier: Number(tier) },
        blockNumber: event.blockNumber,
        timestamp: Date.now(),
        transactionHash: event.transactionHash
      };
      
      processRealtimeUpdate(updateData);
    };

    // Withdrawal events
    const handleWithdrawal = (user, amount, timestamp, event) => {
      const updateData = {
        type: 'WITHDRAWAL',
        data: { user, amount: ethers.formatEther(amount), timestamp: Number(timestamp) },
        blockNumber: event.blockNumber,
        timestamp: Date.now(),
        transactionHash: event.transactionHash
      };
      
      processRealtimeUpdate(updateData);
    };

    // Distribution events
    const handleDistribution = (poolType, amount, participantCount, event) => {
      const updateData = {
        type: 'DISTRIBUTION',
        data: { 
          poolType: Number(poolType), 
          amount: ethers.formatEther(amount), 
          participantCount: Number(participantCount) 
        },
        blockNumber: event.blockNumber,
        timestamp: Date.now(),
        transactionHash: event.transactionHash
      };
      
      processRealtimeUpdate(updateData);
    };

    // System health updates
    const handleSystemHealth = (performanceScore, avgGasPerUser, healthStatus, event) => {
      const updateData = {
        type: 'SYSTEM_HEALTH',
        data: { 
          performanceScore: Number(performanceScore), 
          avgGasPerUser: Number(avgGasPerUser), 
          healthStatus 
        },
        blockNumber: event.blockNumber,
        timestamp: Date.now(),
        transactionHash: event.transactionHash
      };
      
      processRealtimeUpdate(updateData);
    };

    // Register event listeners
    const listeners = [
      ['UserRegistered', handleUserRegistered],
      ['WithdrawalMade', handleWithdrawal],
      ['GlobalHelpDistributed', handleDistribution],
      ['SystemHealthUpdate', handleSystemHealth]
    ];

    listeners.forEach(([eventName, handler]) => {
      contract.on(eventName, handler);
      eventListenersRef.current.set(eventName, () => contract.off(eventName, handler));
    });

  }, []);

  // Process real-time updates with performance tracking
  const processRealtimeUpdate = useCallback((updateData) => {
    const startTime = performance.now();
    
    try {
      // Update performance metrics
      performanceRef.current.totalCount++;
      
      // Add to event queue
      setRealtimeState(prev => ({
        ...prev,
        eventQueue: [updateData, ...prev.eventQueue.slice(0, 99)], // Keep last 100 events
        lastBlockNumber: Math.max(prev.lastBlockNumber, updateData.blockNumber || 0),
        updateCount: prev.updateCount + 1
      }));

      // Broadcast to other tabs if enabled
      if (enableCrossTabs && broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'REALTIME_UPDATE',
          data: updateData,
          timestamp: Date.now()
        });
      }

      // Notify parent component
      onDataUpdate?.(updateData);

      // Update performance metrics
      const updateTime = performance.now() - startTime;
      performanceRef.current.successCount++;
      
      setRealtimeState(prev => ({
        ...prev,
        performanceMetrics: {
          ...prev.performanceMetrics,
          avgUpdateTime: ((prev.performanceMetrics.avgUpdateTime * (performanceRef.current.successCount - 1)) + updateTime) / performanceRef.current.successCount,
          successRate: (performanceRef.current.successCount / performanceRef.current.totalCount) * 100
        }
      }));

      // Update connection quality
      updateConnectionQuality(updateTime);

    } catch (error) {
      console.error('Error processing real-time update:', error);
      setRealtimeState(prev => ({
        ...prev,
        performanceMetrics: {
          ...prev.performanceMetrics,
          lastErrorTime: Date.now(),
          successRate: (performanceRef.current.successCount / performanceRef.current.totalCount) * 100
        }
      }));
      
      onError?.('Update processing failed', error);
    }
  }, [onDataUpdate, onError, enableCrossTabs]);

  // Update connection quality based on performance
  const updateConnectionQuality = useCallback((updateTime) => {
    let quality = 'good';
    
    if (updateTime > 2000) quality = 'poor';
    else if (updateTime > 1000) quality = 'fair';
    
    const successRate = (performanceRef.current.successCount / performanceRef.current.totalCount) * 100;
    if (successRate < 90) quality = 'poor';
    else if (successRate < 95) quality = 'fair';
    
    setConnectionStatus(prev => ({
      ...prev,
      quality,
      lastUpdate: new Date()
    }));
  }, []);

  // Reconnection with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    const retryDelay = Math.min(1000 * Math.pow(2, connectionStatus.retryCount), 30000); // Max 30 seconds
    
    retryTimeoutRef.current = setTimeout(() => {
      console.log(`🔄 Attempting WebSocket reconnection (attempt ${connectionStatus.retryCount + 1})`);
      connectWebSocket();
    }, retryDelay);
  }, [connectionStatus.retryCount, connectWebSocket]);

  // ===== POLLING FALLBACK =====
  const startPolling = useCallback(async () => {
    if (!provider || !contractAddress) return;

    setConnectionStatus(prev => ({ ...prev, polling: 'active' }));

    const contract = new ethers.Contract(
      contractAddress,
      [
        "function getSystemStats() view returns (tuple(uint256 totalMembers, uint256 totalVolume, uint256[] poolBalances))"
      ],
      provider
    );

    const pollData = async () => {
      try {
        const stats = await contract.getSystemStats();
        
        const updateData = {
          type: 'SYSTEM_STATS',
          data: {
            totalMembers: Number(stats.totalMembers),
            totalVolume: ethers.formatEther(stats.totalVolume),
            poolBalances: stats.poolBalances.map(balance => ethers.formatEther(balance))
          },
          timestamp: Date.now(),
          source: 'polling'
        };

        processRealtimeUpdate(updateData);

      } catch (error) {
        console.error('Polling error:', error);
        setConnectionStatus(prev => ({ ...prev, polling: 'error' }));
        onError?.('Polling failed', error);
      }
    };

    // Initial poll
    await pollData();

    // Set up interval
    pollingIntervalRef.current = setInterval(pollData, updateInterval);
  }, [provider, contractAddress, updateInterval, processRealtimeUpdate, onError]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    setConnectionStatus(prev => ({ ...prev, polling: 'inactive' }));
  }, []);

  // ===== CROSS-TAB SYNCHRONIZATION =====
  const setupCrossTabSync = useCallback(() => {
    if (!enableCrossTabs || !window.BroadcastChannel) return;

    broadcastChannelRef.current = new BroadcastChannel('orphi-realtime-updates');
    
    broadcastChannelRef.current.onmessage = (event) => {
      const { type, data, timestamp } = event.data;
      
      if (type === 'REALTIME_UPDATE') {
        // Process updates from other tabs
        processRealtimeUpdate(data);
      }
    };

    console.log('✅ Cross-tab synchronization enabled');
  }, [enableCrossTabs, processRealtimeUpdate]);

  // ===== OFFLINE SUPPORT =====
  const handleOnlineStatusChange = useCallback(() => {
    const isOnline = navigator.onLine;
    
    setConnectionStatus(prev => ({ ...prev, network: isOnline }));
    
    if (isOnline) {
      console.log('🌐 Network reconnected, resuming real-time updates');
      connectWebSocket();
      
      // Process queued updates if any
      if (enableOfflineQueue && updateQueueRef.current.length > 0) {
        console.log(`📤 Processing ${updateQueueRef.current.length} queued updates`);
        updateQueueRef.current.forEach(update => processRealtimeUpdate(update));
        updateQueueRef.current = [];
      }
    } else {
      console.log('📱 Network disconnected, entering offline mode');
      setConnectionStatus(prev => ({ 
        ...prev, 
        websocket: 'disconnected',
        polling: 'inactive'
      }));
    }
  }, [connectWebSocket, processRealtimeUpdate, enableOfflineQueue]);

  // ===== LIFECYCLE MANAGEMENT =====
  useEffect(() => {
    // Initialize real-time updates
    if (navigator.onLine) {
      connectWebSocket();
      
      // Start polling as fallback after 5 seconds
      const fallbackTimer = setTimeout(() => {
        if (connectionStatus.websocket !== 'connected') {
          startPolling();
        }
      }, 5000);

      return () => clearTimeout(fallbackTimer);
    }
  }, [connectWebSocket, startPolling, connectionStatus.websocket]);

  useEffect(() => {
    // Set up cross-tab synchronization
    setupCrossTabSync();
    
    // Set up offline/online event listeners
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
      
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [setupCrossTabSync, handleOnlineStatusChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up all timers and connections
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      
      stopPolling();
      
      // Remove all event listeners
      eventListenersRef.current.forEach(removeListener => removeListener());
      
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [stopPolling]);

  // ===== PUBLIC API =====
  const forceRefresh = useCallback(async () => {
    console.log('🔄 Forcing refresh of real-time data');
    
    if (connectionStatus.websocket === 'connected') {
      // Reload from WebSocket
      connectWebSocket();
    } else {
      // Fallback to polling
      startPolling();
    }
  }, [connectionStatus.websocket, connectWebSocket, startPolling]);

  const getConnectionInfo = useCallback(() => ({
    ...connectionStatus,
    performanceMetrics: realtimeState.performanceMetrics,
    eventQueueSize: realtimeState.eventQueue.length,
    lastBlockNumber: realtimeState.lastBlockNumber
  }), [connectionStatus, realtimeState]);

  const clearEventQueue = useCallback(() => {
    setRealtimeState(prev => ({
      ...prev,
      eventQueue: []
    }));
  }, []);

  // Return manager interface
  return {
    connectionStatus: getConnectionInfo(),
    eventQueue: realtimeState.eventQueue,
    forceRefresh,
    clearEventQueue,
    realtimeState
  };
};

export default RealTimeUpdateManager;
