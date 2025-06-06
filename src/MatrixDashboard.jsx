import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import './OrphiChain.css';
import './OrphiChainEnhanced.css';

/**
 * MatrixDashboard Component
 * 
 * Comprehensive Matrix Dashboard for OrphiMatrix Contract featuring:
 * - Matrix visualization with vis-network
 * - Real-time contract interaction
 * - User lookup and details display
 * - Admin controls for node management
 * - Network exploration (upline/downline)
 * - Registration status checking
 */

const MatrixDashboard = ({ 
  contractAddress, 
  provider, 
  userAddress, 
  demoMode = false 
}) => {
  // ===== STATE MANAGEMENT =====
  const [web3, setWeb3] = useState(null);
  const [contract, setContract] = useState(null);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Matrix data states
  const [matrixData, setMatrixData] = useState(null);
  const [userLookupAddress, setUserLookupAddress] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [matrixStats, setMatrixStats] = useState({
    totalNodes: 0,
    activeNodes: 0,
    maxLevel: 0
  });
  
  // Network visualization states
  const [networkContainer, setNetworkContainer] = useState(null);
  const [visNetwork, setVisNetwork] = useState(null);
  const networkRef = useRef(null);
  
  // UI states
  const [activeTab, setActiveTab] = useState('visualization');
  const [selectedNode, setSelectedNode] = useState(null);
  const [adminMode, setAdminMode] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [expandedView, setExpandedView] = useState(false);
  const [networkAnalytics, setNetworkAnalytics] = useState({
    totalVolume: 0,
    averageTeamSize: 0,
    activationRate: 0,
    growthRate: 0
  });
  // ====== TEAM SIZE, UPLINE, DOWNLINE EXPLORATION UI =====
  const [teamSize, setTeamSize] = useState(null);
  const [uplineChain, setUplineChain] = useState([]);
  const [downline, setDownline] = useState([]);

  // Contract ABI for OrphiMatrix
  const matrixABI = [
    {
      "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
      "name": "matrixNodes",
      "outputs": [
        {"internalType": "address", "name": "user", "type": "address"},
        {"internalType": "address", "name": "parent", "type": "address"},
        {"internalType": "address", "name": "leftChild", "type": "address"},
        {"internalType": "address", "name": "rightChild", "type": "address"},
        {"internalType": "uint256", "name": "position", "type": "uint256"},
        {"internalType": "uint256", "name": "teamSize", "type": "uint256"},
        {"internalType": "uint256", "name": "level", "type": "uint256"},
        {"internalType": "bool", "name": "isActive", "type": "bool"}
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
      "name": "isUserRegistered",
      "outputs": [{"internalType": "bool", "name": "registered", "type": "bool"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getMatrixStats",
      "outputs": [
        {"internalType": "uint256", "name": "totalNodes_", "type": "uint256"},
        {"internalType": "uint256", "name": "activeNodes", "type": "uint256"},
        {"internalType": "uint256", "name": "maxLevel", "type": "uint256"}
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "user", "type": "address"},
        {"internalType": "uint256", "name": "levels", "type": "uint256"}
      ],
      "name": "getUpline",
      "outputs": [{"internalType": "address[]", "name": "upline", "type": "address[]"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "user", "type": "address"},
        {"internalType": "uint256", "name": "targetLevel", "type": "uint256"}
      ],
      "name": "getDownlineAtLevel",
      "outputs": [{"internalType": "address[]", "name": "downline", "type": "address[]"}],
      "stateMutability": "view",
      "type": "function"
    }
  ];

  // ===== DEMO DATA =====
  const generateDemoData = useCallback(() => {
    return {
      nodes: [
        { id: 1, label: 'Root\n0x1234...5678', level: 0, parent: null, position: 1, isActive: true, teamSize: 15, address: '0x1234567890123456789012345678901234567890' },
        { id: 2, label: 'Node 1\n0x2345...6789', level: 1, parent: 1, position: 2, isActive: true, teamSize: 7, address: '0x2345678901234567890123456789012345678901' },
        { id: 3, label: 'Node 2\n0x3456...7890', level: 1, parent: 1, position: 3, isActive: true, teamSize: 8, address: '0x3456789012345678901234567890123456789012' },
        { id: 4, label: 'Node 3\n0x4567...8901', level: 2, parent: 2, position: 4, isActive: true, teamSize: 3, address: '0x4567890123456789012345678901234567890123' },
        { id: 5, label: 'Node 4\n0x5678...9012', level: 2, parent: 2, position: 5, isActive: false, teamSize: 4, address: '0x5678901234567890123456789012345678901234' },
        { id: 6, label: 'Node 5\n0x6789...0123', level: 2, parent: 3, position: 6, isActive: true, teamSize: 2, address: '0x6789012345678901234567890123456789012345' },
        { id: 7, label: 'Node 6\n0x7890...1234', level: 2, parent: 3, position: 7, isActive: true, teamSize: 6, address: '0x7890123456789012345678901234567890123456' },
        { id: 8, label: 'Node 7\n0x8901...2345', level: 3, parent: 4, position: 8, isActive: true, teamSize: 1, address: '0x8901234567890123456789012345678901234567' },
        { id: 9, label: 'Node 8\n0x9012...3456', level: 3, parent: 6, position: 9, isActive: false, teamSize: 0, address: '0x9012345678901234567890123456789012345678' }
      ],
      edges: [
        { from: 1, to: 2, label: 'Left' },
        { from: 1, to: 3, label: 'Right' },
        { from: 2, to: 4, label: 'Left' },
        { from: 2, to: 5, label: 'Right' },
        { from: 3, to: 6, label: 'Left' },
        { from: 3, to: 7, label: 'Right' },
        { from: 4, to: 8, label: 'Left' },
        { from: 6, to: 9, label: 'Right' }
      ]
    };
  }, []);

  // ===== CONTRACT INTERACTION =====
  const initializeContract = useCallback(async () => {
    if (!provider || !contractAddress || demoMode) {
      console.log('Using demo mode or missing provider/contract address');
      return;
    }

    try {
      setLoading(true);
      const signer = provider.getSigner();
      const contractInstance = new ethers.Contract(contractAddress, matrixABI, signer);
      setContract(contractInstance);
      
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        setCurrentAccount(accounts[0]);
        setIsConnected(true);
      }
    } catch (err) {
      console.error('Error initializing contract:', err);
      setError('Failed to initialize contract connection');
    } finally {
      setLoading(false);
    }
  }, [provider, contractAddress, demoMode]);

  const loadMatrixStats = useCallback(async () => {
    if (demoMode) {
      setMatrixStats({
        totalNodes: 9,
        activeNodes: 7,
        maxLevel: 3
      });
      
      // Demo analytics
      setNetworkAnalytics({
        totalVolume: 45000,
        averageTeamSize: 5.2,
        activationRate: 77.8,
        growthRate: 15.3
      });
      return;
    }

    if (!contract) return;

    try {
      const stats = await contract.getMatrixStats();
      setMatrixStats({
        totalNodes: stats.totalNodes_.toNumber(),
        activeNodes: stats.activeNodes.toNumber(),
        maxLevel: stats.maxLevel.toNumber()
      });
      
      // Calculate additional analytics
      const activationRate = (stats.activeNodes.toNumber() / stats.totalNodes_.toNumber()) * 100;
      setNetworkAnalytics(prev => ({
        ...prev,
        activationRate: activationRate.toFixed(1)
      }));
    } catch (err) {
      console.error('Error loading matrix stats:', err);
      addNotification('Failed to load matrix statistics', 'error');
    }
  }, [contract, demoMode]);

  const lookupUser = useCallback(async () => {
    if (!userLookupAddress) {
      setError('Please enter a valid address');
      return;
    }

    if (demoMode) {
      // Demo lookup result
      setLookupResult({
        isRegistered: true,
        nodeData: {
          user: userLookupAddress,
          parent: '0x1234567890123456789012345678901234567890',
          leftChild: '0x2345678901234567890123456789012345678901',
          rightChild: '0x3456789012345678901234567890123456789012',
          position: 5,
          teamSize: 12,
          level: 2,
          isActive: true
        }
      });
      return;
    }

    if (!contract) {
      setError('Contract not connected');
      return;
    }

    try {
      setLoading(true);
      const isRegistered = await contract.isUserRegistered(userLookupAddress);
      
      if (isRegistered) {
        const nodeData = await contract.matrixNodes(userLookupAddress);
        setLookupResult({
          isRegistered: true,
          nodeData: {
            user: nodeData.user,
            parent: nodeData.parent,
            leftChild: nodeData.leftChild,
            rightChild: nodeData.rightChild,
            position: nodeData.position.toNumber(),
            teamSize: nodeData.teamSize.toNumber(),
            level: nodeData.level.toNumber(),
            isActive: nodeData.isActive
          }
        });
      } else {
        setLookupResult({
          isRegistered: false,
          nodeData: null
        });
      }
    } catch (err) {
      console.error('Error looking up user:', err);
      setError('Failed to lookup user');
    } finally {
      setLoading(false);
    }
  }, [userLookupAddress, contract, demoMode]);

  // ===== NETWORK VISUALIZATION =====
  const initializeNetwork = useCallback(() => {
    if (!networkRef.current) return;

    const data = demoMode ? generateDemoData() : matrixData;
    if (!data) return;

    // Vis.js network options
    const options = {
      layout: {
        hierarchical: {
          enabled: true,
          levelSeparation: 100,
          nodeSpacing: 150,
          treeSpacing: 200,
          blockShifting: true,
          edgeMinimization: true,
          parentCentralization: true,
          direction: 'UD',
          sortMethod: 'directed'
        }
      },
      nodes: {
        shape: 'box',
        margin: 10,
        font: {
          size: 12,
          color: 'white'
        },
        borderWidth: 2,
        shadow: true,
        chosen: {
          node: (values, id, selected, hovering) => {
            values.color = '#00D4FF';
            values.borderColor = '#00FF88';
          }
        }
      },
      edges: {
        arrows: {
          to: { enabled: true, scaleFactor: 1, type: 'arrow' }
        },
        color: { color: '#00D4FF' },
        width: 2,
        smooth: {
          enabled: true,
          type: 'cubicBezier',
          forceDirection: 'vertical',
          roundness: 0.4
        }
      },
      physics: {
        enabled: false
      },
      interaction: {
        dragNodes: true,
        zoomView: true,
        selectConnectedEdges: true
      }
    };

    // Color nodes based on status
    const processedNodes = data.nodes.map(node => ({
      ...node,
      color: {
        background: node.isActive ? '#00FF88' : '#FF6B35',
        border: node.level === 0 ? '#FFD700' : '#00D4FF',
        highlight: { background: '#00D4FF', border: '#FFD700' }
      }
    }));

    const networkData = {
      nodes: processedNodes,
      edges: data.edges
    };

    // Create or update network
    if (visNetwork) {
      visNetwork.setData(networkData);
    } else {
      const network = new window.vis.Network(networkRef.current, networkData, options);
      
      // Event listeners
      network.on('selectNode', (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const node = data.nodes.find(n => n.id === nodeId);
          setSelectedNode(node);
        }
      });

      network.on('deselectNode', () => {
        setSelectedNode(null);
      });

      setVisNetwork(network);
    }
  }, [generateDemoData, matrixData, demoMode, visNetwork]);

  // ===== NOTIFICATION SYSTEM =====
  const addNotification = useCallback((message, type = 'info') => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, []);

  // ===== ADMIN FUNCTIONS =====
  const [pendingTx, setPendingTx] = useState(false);

  const toggleNodeStatus = useCallback(async (nodeAddress, newStatus) => {
    if (demoMode) {
      addNotification(`Node ${nodeAddress.slice(0, 6)}...${nodeAddress.slice(-4)} ${newStatus ? 'activated' : 'deactivated'}`, 'success');
      setSelectedNode(prev => prev ? { ...prev, isActive: newStatus } : prev);
      return;
    }

    if (!contract || !adminMode) return;

    // Confirmation dialog
    const confirmMsg = `Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this node?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      setPendingTx(true);
      // Optimistically update UI
      setSelectedNode(prev => prev ? { ...prev, isActive: newStatus } : prev);
      const tx = await contract.setNodeActive(nodeAddress, newStatus);
      addNotification('Transaction submitted, waiting for confirmation...', 'info');
      await tx.wait();
      addNotification(`Node status updated successfully!`, 'success');
      loadMatrixStats(); // Refresh stats
    } catch (err) {
      console.error('Error updating node status:', err);
      addNotification('Failed to update node status', 'error');
      // Revert optimistic update
      setSelectedNode(prev => prev ? { ...prev, isActive: !newStatus } : prev);
    } finally {
      setLoading(false);
      setPendingTx(false);
    }
  }, [contract, adminMode, demoMode, loadMatrixStats]);

  const exploreUpline = useCallback(async (userAddress, levels = 3) => {
    if (demoMode) {
      addNotification(`Exploring upline for ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`, 'info');
      return;
    }

    if (!contract) return;

    try {
      const upline = await contract.getUpline(userAddress, levels);
      addNotification(`Found ${upline.length} upline members`, 'success');
      return upline;
    } catch (err) {
      console.error('Error exploring upline:', err);
      addNotification('Failed to explore upline', 'error');
    }
  }, [contract, demoMode]);

  const exploreDownline = useCallback(async (userAddress, level = 1) => {
    if (demoMode) {
      addNotification(`Exploring downline level ${level} for ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`, 'info');
      return;
    }

    if (!contract) return;

    try {
      const downline = await contract.getDownlineAtLevel(userAddress, level);
      addNotification(`Found ${downline.length} members at level ${level}`, 'success');
      return downline;
    } catch (err) {
      console.error('Error exploring downline:', err);
      addNotification('Failed to explore downline', 'error');
    }
  }, [contract, demoMode]);

  // ====== EVENT LISTENERS FOR REAL-TIME UPDATES =====
  useEffect(() => {
    if (!contract || demoMode) return;
    contract.removeAllListeners && contract.removeAllListeners();

    // Matrix events (already present)
    contract.on('MatrixPlacement', (user, parent, position, isLeftChild, level) => {
      const placementMsg = `🎯 Placement: User ${user.slice(0,6)}... placed under ${parent.slice(0,6)}... at position ${position} (${isLeftChild ? 'Left' : 'Right'}), level ${level}`;
      addNotification(placementMsg, 'success');
      loadMatrixStats();
    });
    contract.on('TeamSizeUpdate', (user, newTeamSize) => {
      addNotification(`👥 Team size updated for ${user.slice(0,6)}...: ${newTeamSize}`, 'info');
      loadMatrixStats();
    });
    contract.on('MatrixNodeActivated', (user, position) => {
      addNotification(`✅ Node activated: ${user.slice(0,6)}... (pos ${position})`, 'success');
      loadMatrixStats();
    });
    contract.on('MatrixNodeDeactivated', (user, position) => {
      addNotification(`⛔ Node deactivated: ${user.slice(0,6)}... (pos ${position})`, 'error');
      loadMatrixStats();
    });

    // Additional OrphiMatrix/OrphiCrowdFund events
    contract.on('UserRegistered', (user, sponsor, packageTier, userId) => {
      addNotification(`🆕 User Registered: ${user.slice(0,6)}... (Sponsor: ${sponsor.slice(0,6)}..., Tier: ${packageTier}, ID: ${userId})`, 'success');
    });
    contract.on('CommissionPaid', (recipient, amount, poolType, from) => {
      addNotification(`💸 Commission Paid: ${amount} to ${recipient.slice(0,6)}... (Pool: ${poolType}, From: ${from.slice(0,6)}...)`, 'info');
    });
    contract.on('WithdrawalMade', (user, amount) => {
      addNotification(`🏦 Withdrawal: ${user.slice(0,6)}... withdrew ${amount}`, 'info');
    });
    contract.on('GlobalHelpDistributed', (totalAmount, participantCount) => {
      addNotification(`🌍 Global Help Pool: ${totalAmount} distributed to ${participantCount} participants`, 'success');
    });
    contract.on('LeaderBonusDistributed', (totalAmount, leadersCount) => {
      addNotification(`🏅 Leader Bonus: ${totalAmount} distributed to ${leadersCount} leaders`, 'success');
    });
    contract.on('AutomationExecuted', (taskType, amount, success) => {
      addNotification(`🤖 Automation: Task ${taskType} executed (${success ? 'Success' : 'Fail'}), Amount: ${amount}`, success ? 'success' : 'error');
    });
    contract.on('AutomationFailed', (taskType, reason) => {
      addNotification(`⚠️ Automation Failed: Task ${taskType}, Reason: ${reason}`, 'error');
    });
    contract.on('CircuitBreakerTriggered', (consecutiveFailures) => {
      addNotification(`🚨 Circuit Breaker Triggered! Failures: ${consecutiveFailures}`, 'error');
    });
    contract.on('CircuitBreakerReset', (admin) => {
      addNotification(`🔄 Circuit Breaker Reset by ${admin.slice(0,6)}...`, 'info');
    });
    contract.on('EmergencyModeActivated', (admin) => {
      addNotification(`🛑 Emergency Mode Activated by ${admin.slice(0,6)}...`, 'error');
    });
    contract.on('EmergencyModeDeactivated', (admin) => {
      addNotification(`✅ Emergency Mode Deactivated by ${admin.slice(0,6)}...`, 'success');
    });
    contract.on('RealTimeEvent', (eventType, user, eventData) => {
      addNotification(`⏱️ Real-Time Event: ${eventType} for ${user.slice(0,6)}...`, 'info');
    });

    return () => {
      contract.removeAllListeners && contract.removeAllListeners();
    };
  }, [contract, demoMode, loadMatrixStats, addNotification]);

  // ===== EFFECTS =====
  useEffect(() => {
    initializeContract();
  }, [initializeContract]);

  useEffect(() => {
    loadMatrixStats();
  }, [loadMatrixStats]);

  useEffect(() => {
    // Load vis.js if not available
    if (typeof window !== 'undefined' && !window.vis) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/vis-network/standalone/umd/vis-network.min.js';
      script.onload = () => {
        initializeNetwork();
      };
      document.head.appendChild(script);
    } else {
      initializeNetwork();
    }
  }, [initializeNetwork]);

  // ===== RENDER HELPERS =====
  const renderConnectionStatus = () => (
    <div className="connection-status" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '15px'
    }}>
      <div 
        className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: isConnected ? '#00FF88' : '#FF6B35',
          boxShadow: `0 0 10px ${isConnected ? '#00FF88' : '#FF6B35'}`
        }}
      />
      <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
      {currentAccount && (
        <span style={{ color: '#00D4FF' }}>
          {currentAccount.slice(0, 6)}...{currentAccount.slice(-4)}
        </span>
      )}
    </div>
  );

  const renderMatrixStats = () => (
    <div className="matrix-stats" style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '15px',
      marginBottom: '20px'
    }}>
      <div className="stat-card" style={{
        background: 'rgba(0, 212, 255, 0.1)',
        border: '1px solid #00D4FF',
        borderRadius: '10px',
        padding: '15px',
        textAlign: 'center'
      }}>
        <div style={{ color: '#00D4FF', fontSize: '0.9rem', marginBottom: '5px' }}>
          Total Nodes
        </div>
        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white' }}>
          {matrixStats.totalNodes}
        </div>
      </div>

      <div className="stat-card" style={{
        background: 'rgba(0, 255, 136, 0.1)',
        border: '1px solid #00FF88',
        borderRadius: '10px',
        padding: '15px',
        textAlign: 'center'
      }}>
        <div style={{ color: '#00FF88', fontSize: '0.9rem', marginBottom: '5px' }}>
          Active Nodes
        </div>
        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white' }}>
          {matrixStats.activeNodes}
        </div>
      </div>

      <div className="stat-card" style={{
        background: 'rgba(255, 107, 53, 0.1)',
        border: '1px solid #FF6B35',
        borderRadius: '10px',
        padding: '15px',
        textAlign: 'center'
      }}>
        <div style={{ color: '#FF6B35', fontSize: '0.9rem', marginBottom: '5px' }}>
          Max Level
        </div>
        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white' }}>
          {matrixStats.maxLevel}
        </div>
      </div>
    </div>
  );

  const renderUserLookup = () => (
    <div className="user-lookup" style={{
      background: 'rgba(0, 0, 0, 0.3)',
      border: '1px solid #00D4FF',
      borderRadius: '15px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      <h3 style={{ color: '#00D4FF', marginBottom: '15px' }}>
        🔍 User Lookup
      </h3>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <input
          type="text"
          placeholder="Enter user address (0x...)"
          value={userLookupAddress}
          onChange={(e) => setUserLookupAddress(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && lookupUser()}
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid #00D4FF',
            borderRadius: '8px',
            padding: '10px',
            color: 'white',
            fontSize: '14px'
          }}
        />
        <button
          onClick={lookupUser}
          disabled={loading}
          style={{
            background: 'linear-gradient(45deg, #00D4FF, #00FF88)',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            color: 'white',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Looking up...' : 'Lookup'}
        </button>
      </div>

      {lookupResult && (
        <div className="lookup-result" style={{
          background: lookupResult.isRegistered 
            ? 'rgba(0, 255, 136, 0.1)' 
            : 'rgba(255, 107, 53, 0.1)',
          border: `1px solid ${lookupResult.isRegistered ? '#00FF88' : '#FF6B35'}`,
          borderRadius: '10px',
          padding: '15px'
        }}>
          <h4 style={{ 
            color: lookupResult.isRegistered ? '#00FF88' : '#FF6B35',
            marginBottom: '10px'
          }}>
            {lookupResult.isRegistered ? '✅ User Found' : '❌ User Not Registered'}
          </h4>

          {lookupResult.isRegistered && lookupResult.nodeData && (
            <div className="node-details" style={{ fontSize: '14px', lineHeight: '1.6' }}>
              <div><strong>Position:</strong> {lookupResult.nodeData.position}</div>
              <div><strong>Level:</strong> {lookupResult.nodeData.level}</div>
              <div><strong>Team Size:</strong> {lookupResult.nodeData.teamSize}</div>
              <div>
                <strong>Status:</strong> 
                <span style={{ 
                  color: lookupResult.nodeData.isActive ? '#00FF88' : '#FF6B35',
                  marginLeft: '5px'
                }}>
                  {lookupResult.nodeData.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div><strong>Parent:</strong> {lookupResult.nodeData.parent !== '0x0000000000000000000000000000000000000000' 
                ? `${lookupResult.nodeData.parent.slice(0, 6)}...${lookupResult.nodeData.parent.slice(-4)}`
                : 'Root Node'
              }</div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderVisualization = () => (
    <div className="matrix-visualization" style={{
      background: 'rgba(0, 0, 0, 0.3)',
      border: '1px solid #00D4FF',
      borderRadius: '15px',
      padding: '20px',
      height: '600px'
    }}>
      <h3 style={{ color: '#00D4FF', marginBottom: '15px' }}>
        🌐 Matrix Network Visualization
      </h3>
      
      <div 
        ref={networkRef}
        style={{
          width: '100%',
          height: '520px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '10px',
          border: '1px solid rgba(0, 212, 255, 0.3)'
        }}
      />
    </div>
  );

  const renderSelectedNodeInfo = () => {
    if (!selectedNode) return null;

    return (
      <div className="selected-node-info" style={{
        background: 'rgba(0, 0, 0, 0.5)',
        border: '2px solid #00D4FF',
        borderRadius: '15px',
        padding: '20px',
        marginTop: '20px'
      }}>
        <h3 style={{ color: '#00D4FF', marginBottom: '15px' }}>
          📊 Selected Node Details
        </h3>
        <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <div><strong>User:</strong> {selectedNode.address}</div>
          <div><strong>Parent:</strong> {selectedNode.parent}</div>
          <div><strong>Left Child:</strong> {selectedNode.leftChild || 'None'}</div>
          <div><strong>Right Child:</strong> {selectedNode.rightChild || 'None'}</div>
          <div><strong>Position:</strong> {selectedNode.position}</div>
          <div><strong>Level:</strong> {selectedNode.level}</div>
          <div><strong>Team Size:</strong> {selectedNode.teamSize}</div>
          <div><strong>Status:</strong> <span style={{ color: selectedNode.isActive ? '#00FF88' : '#FF6B35' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: selectedNode.isActive ? '#00FF88' : '#FF6B35', marginRight: 6 }} />
            {selectedNode.isActive ? 'Active' : 'Inactive'}
          </span></div>
          {/* Team/Upline/Downline Exploration */}
          <button onClick={handleExploreTeam} disabled={loading} style={{marginTop: '10px'}}>Explore Team/Upline/Downline</button>
          {teamSize !== null && (
            <div style={{marginTop: '10px'}}>
              <div><b>Team Size:</b> {teamSize}</div>
              <div><b>Upline (3 levels):</b>
                <ul>{uplineChain.map((addr, i) => <li key={i}>{addr}</li>)}</ul>
              </div>
              <div><b>Downline (next level):</b>
                <ul>{downline.map((addr, i) => <li key={i}>{addr}</li>)}</ul>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ===== TEAM/Upline/Downline Exploration Handler =====
  const handleExploreTeam = useCallback(async () => {
    if (!selectedNode) return;
    setTeamSize(null);
    setUplineChain([]);
    setDownline([]);
    if (demoMode) {
      // Demo: Simulate upline and downline
      setTeamSize(selectedNode.teamSize);
      setUplineChain([
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333'
      ]);
      setDownline([
        '0x4444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555'
      ]);
      return;
    }
    if (!contract) return;
    try {
      setLoading(true);
      // Team size is already in selectedNode.teamSize
      setTeamSize(selectedNode.teamSize);
      // Fetch upline (3 levels)
      const upline = await contract.getUpline(selectedNode.address, 3);
      setUplineChain(upline);
      // Fetch downline (next level)
      const downline = await contract.getDownlineAtLevel(selectedNode.address, selectedNode.level + 1);
      setDownline(downline);
    } catch (err) {
      addNotification('Failed to explore team/upline/downline', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedNode, contract, demoMode]);

  // ===== ENHANCED UI COMPONENTS =====
  const renderNotifications = () => {
    if (notifications.length === 0) return null;

    return (
      <div className="notifications-container" style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        maxWidth: '400px'
      }}>
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`notification notification-${notification.type}`}
            style={{
              background: notification.type === 'error' 
                ? 'rgba(255, 107, 53, 0.9)' 
                : notification.type === 'success'
                ? 'rgba(0, 255, 136, 0.9)'
                : 'rgba(0, 212, 255, 0.9)',
              border: `1px solid ${notification.type === 'error' ? '#FF6B35' : notification.type === 'success' ? '#00FF88' : '#00D4FF'}`,
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '10px',
              color: 'white',
              fontSize: '14px',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              animation: 'slideInRight 0.3s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{notification.message}</span>
              <span style={{ fontSize: '12px', opacity: 0.8 }}>{notification.timestamp}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderAdminPanel = () => {
    if (!adminMode) return null;

    return (
      <div className="admin-panel" style={{
        background: 'rgba(255, 107, 53, 0.1)',
        border: '2px solid #FF6B35',
        borderRadius: '15px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#FF6B35', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fas fa-shield-alt" />
          Admin Controls
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <button
            onClick={() => selectedNode && toggleNodeStatus(selectedNode.address, !selectedNode.isActive)}
            disabled={!selectedNode || loading || pendingTx}
            style={{
              background: selectedNode?.isActive ? 'rgba(255, 107, 53, 0.2)' : 'rgba(0, 255, 136, 0.2)',
              border: `1px solid ${selectedNode?.isActive ? '#FF6B35' : '#00FF88'}`,
              borderRadius: '8px',
              padding: '10px 15px',
              color: 'white',
              cursor: !selectedNode || loading || pendingTx ? 'not-allowed' : 'pointer',
              opacity: !selectedNode || loading || pendingTx ? 0.5 : 1
            }}
          >
            {pendingTx
              ? 'Pending...'
              : selectedNode
                ? (selectedNode.isActive ? 'Deactivate Node' : 'Activate Node')
                : 'Select Node First'}
          </button>

          <button
            onClick={() => selectedNode && exploreUpline(selectedNode.address)}
            disabled={!selectedNode || loading}
            style={{
              background: 'rgba(0, 212, 255, 0.2)',
              border: '1px solid #00D4FF',
              borderRadius: '8px',
              padding: '10px 15px',
              color: 'white',
              cursor: !selectedNode || loading ? 'not-allowed' : 'pointer',
              opacity: !selectedNode || loading ? 0.5 : 1
            }}
          >
            Explore Upline
          </button>

          <button
            onClick={() => selectedNode && exploreDownline(selectedNode.address)}
            disabled={!selectedNode || loading}
            style={{
              background: 'rgba(123, 44, 191, 0.2)',
              border: '1px solid #7B2CBF',
              borderRadius: '8px',
              padding: '10px 15px',
              color: 'white',
              cursor: !selectedNode || loading ? 'not-allowed' : 'pointer',
              opacity: !selectedNode || loading ? 0.5 : 1
            }}
          >
            Explore Downline
          </button>
        </div>

        {selectedNode && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            <strong>Selected Node:</strong> {selectedNode.address}
          </div>
        )}
      </div>
    );
  };

  const renderNetworkAnalytics = () => (
    <div className="network-analytics" style={{
      background: 'rgba(0, 0, 0, 0.3)',
      border: '1px solid #00D4FF',
      borderRadius: '15px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      <h3 style={{ color: '#00D4FF', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <i className="fas fa-chart-line" />
        Network Analytics
      </h3>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '15px'
      }}>
        <div className="analytic-card" style={{
          background: 'rgba(0, 255, 136, 0.1)',
          border: '1px solid #00FF88',
          borderRadius: '10px',
          padding: '15px',
          textAlign: 'center'
        }}>
          <div style={{ color: '#00FF88', fontSize: '0.9rem', marginBottom: '5px' }}>
            Total Volume
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'white' }}>
            ${networkAnalytics.totalVolume.toLocaleString()}
          </div>
        </div>

        <div className="analytic-card" style={{
          background: 'rgba(123, 44, 191, 0.1)',
          border: '1px solid #7B2CBF',
          borderRadius: '10px',
          padding: '15px',
          textAlign: 'center'
        }}>
          <div style={{ color: '#7B2CBF', fontSize: '0.9rem', marginBottom: '5px' }}>
            Avg Team Size
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'white' }}>
            {networkAnalytics.averageTeamSize}
          </div>
        </div>

        <div className="analytic-card" style={{
          background: 'rgba(255, 215, 0, 0.1)',
          border: '1px solid #FFD700',
          borderRadius: '10px',
          padding: '15px',
          textAlign: 'center'
        }}>
          <div style={{ color: '#FFD700', fontSize: '0.9rem', marginBottom: '5px' }}>
            Activation Rate
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'white' }}>
            {networkAnalytics.activationRate}%
          </div>
        </div>

        <div className="analytic-card" style={{
          background: 'rgba(0, 212, 255, 0.1)',
          border: '1px solid #00D4FF',
          borderRadius: '10px',
          padding: '15px',
          textAlign: 'center'
        }}>
          <div style={{ color: '#00D4FF', fontSize: '0.9rem', marginBottom: '5px' }}>
            Growth Rate
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'white' }}>
            +{networkAnalytics.growthRate}%
          </div>
        </div>
      </div>
    </div>
  );

  // ===== MAIN RENDER =====
  return (
    <div className="matrix-dashboard" style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      minHeight: '100vh',
      color: 'white',
      padding: '20px'
    }}>
      <div className="container" style={{ maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* Header */}
        <div className="header" style={{
          background: 'rgba(0, 0, 0, 0.3)',
          border: '2px solid #00D4FF',
          borderRadius: '15px',
          padding: '20px',
          marginBottom: '20px',
          backdropFilter: 'blur(10px)'
        }}>
          <h1 style={{
            color: '#00D4FF',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <i className="fas fa-project-diagram" />
            Orphi Matrix Dashboard
            {demoMode && (
              <span style={{
                background: 'rgba(255, 107, 53, 0.2)',
                border: '1px solid #FF6B35',
                borderRadius: '20px',
                padding: '5px 15px',
                fontSize: '0.6rem',
                color: '#FF6B35'
              }}>
                DEMO MODE
              </span>
            )}
          </h1>
          
          {renderConnectionStatus()}
          
          {error && (
            <div style={{
              background: 'rgba(255, 107, 53, 0.2)',
              border: '1px solid #FF6B35',
              borderRadius: '10px',
              padding: '10px',
              color: '#FF6B35',
              marginTop: '10px'
            }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Matrix Statistics */}
        {renderMatrixStats()}

        {/* Main Content Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: '20px',
          marginBottom: '20px'
        }}>
          {/* Left Panel - Controls */}
          <div>
            {renderUserLookup()}
            {renderSelectedNodeInfo()}
            {renderAdminPanel()}
          </div>

          {/* Right Panel - Visualization */}
          <div>
            {renderVisualization()}
            {renderNetworkAnalytics()}
          </div>
        </div>

        {/* Notifications */}
        {renderNotifications()}

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          color: '#B0B0B0',
          background: 'rgba(0, 212, 255, 0.05)',
          padding: '15px',
          borderRadius: '10px',
          border: '1px solid rgba(0, 212, 255, 0.2)'
        }}>
          <div>✅ Matrix Dashboard Active | OrphiChain Binary Tree Network</div>
          {demoMode && (
            <div style={{ marginTop: '5px', color: '#FF6B35' }}>
              🔄 Demo Mode: Displaying simulated data
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatrixDashboard;
