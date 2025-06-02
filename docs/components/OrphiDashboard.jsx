import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

/**
 * Real-time Monitoring Dashboard for Orphi CrowdFund
 * 
 * Features:
 * - Live system statistics
 * - User activity monitoring
 * - Pool balance tracking
 * - Registration trends
 * - Alert system for anomalies
 */

const COLORS = {
  sponsor: '#8884d8',
  level: '#82ca9d',
  upline: '#ffc658',
  leader: '#ff7c7c',
  ghp: '#8dd1e1'
};

const OrphiDashboard = ({ contractAddress, provider }) => {
  const [systemStats, setSystemStats] = useState({
    totalMembers: 0,
    totalVolume: 0,
    poolBalances: [0, 0, 0, 0, 0],
    lastGHPDistribution: 0,
    dailyRegistrations: 0
  });

  const [realtimeData, setRealtimeData] = useState({
    registrations: [],
    withdrawals: [],
    poolHistory: [],
    alerts: []
  });

  const [contract, setContract] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Initialize contract connection
  useEffect(() => {
    const initContract = async () => {
      if (!contractAddress || !provider) return;

      try {
        // Import contract ABI (would be from build artifacts)
        const contractABI = [
          // Essential ABI for monitoring
          "function totalMembers() view returns (uint256)",
          "function totalVolume() view returns (uint256)",
          "function getPoolBalances() view returns (uint256[5])",
          "function getSystemStatsEnhanced() view returns (uint32, uint128, uint256, uint256, uint256, uint256)",
          "event UserRegistered(address indexed user, address indexed sponsor, uint8 packageTier, uint256 userId)",
          "event WithdrawalMade(address indexed user, uint256 amount)",
          "event GlobalHelpDistributed(uint256 totalAmount, uint256 participantCount)",
          "event CommissionPaid(address indexed recipient, uint256 amount, uint256 poolType, address indexed from)"
        ];

        const contractInstance = new ethers.Contract(contractAddress, contractABI, provider);
        setContract(contractInstance);
        setIsConnected(true);

        // Initial data load
        await loadSystemStats(contractInstance);
        
      } catch (error) {
        console.error("Error initializing contract:", error);
        addAlert("Error connecting to contract", "error");
      }
    };

    initContract();
  }, [contractAddress, provider]);

  // Load system statistics
  const loadSystemStats = useCallback(async (contractInstance = contract) => {
    if (!contractInstance) return;

    try {
      // Check if enhanced version is available
      let stats;
      try {
        stats = await contractInstance.getSystemStatsEnhanced();
        setSystemStats({
          totalMembers: Number(stats[0]),
          totalVolume: ethers.formatEther(stats[1]),
          lastGHPDistribution: Number(stats[2]),
          lastLeaderDistribution: Number(stats[3]),
          dailyRegistrations: Number(stats[4]),
          dailyWithdrawals: Number(stats[5])
        });
      } catch {
        // Fallback to V1 methods
        const [totalMembers, totalVolume, poolBalances] = await Promise.all([
          contractInstance.totalMembers(),
          contractInstance.totalVolume(),
          contractInstance.getPoolBalances()
        ]);

        setSystemStats({
          totalMembers: Number(totalMembers),
          totalVolume: ethers.formatEther(totalVolume),
          poolBalances: poolBalances.map(balance => ethers.formatEther(balance)),
          dailyRegistrations: 0,
          dailyWithdrawals: 0
        });
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error loading system stats:", error);
      addAlert("Failed to load system statistics", "error");
    }
  }, [contract]);

  // Set up event listeners
  useEffect(() => {
    if (!contract) return;

    const handleUserRegistered = (user, sponsor, packageTier, userId, event) => {
      const registration = {
        id: event.transactionHash,
        timestamp: Date.now(),
        user,
        sponsor,
        packageTier: Number(packageTier),
        userId: Number(userId),
        blockNumber: event.blockNumber
      };

      setRealtimeData(prev => ({
        ...prev,
        registrations: [registration, ...prev.registrations.slice(0, 49)] // Keep last 50
      }));

      addAlert(`New registration: User ${registration.userId}`, "info");
      loadSystemStats(); // Refresh stats
    };

    const handleWithdrawal = (user, amount, event) => {
      const withdrawal = {
        id: event.transactionHash,
        timestamp: Date.now(),
        user,
        amount: ethers.formatEther(amount),
        blockNumber: event.blockNumber
      };

      setRealtimeData(prev => ({
        ...prev,
        withdrawals: [withdrawal, ...prev.withdrawals.slice(0, 49)] // Keep last 50
      }));

      addAlert(`Withdrawal: ${withdrawal.amount} USDT by ${user.slice(0, 8)}...`, "info");
    };

    const handleGHPDistribution = (totalAmount, participantCount, event) => {
      addAlert(
        `GHP Distribution: ${ethers.formatEther(totalAmount)} USDT to ${participantCount} users`,
        "success"
      );
      loadSystemStats(); // Refresh stats
    };

    // Subscribe to events
    contract.on("UserRegistered", handleUserRegistered);
    contract.on("WithdrawalMade", handleWithdrawal);
    contract.on("GlobalHelpDistributed", handleGHPDistribution);

    // Cleanup
    return () => {
      contract.removeAllListeners();
    };
  }, [contract, loadSystemStats]);

  // Auto-refresh system stats
  useEffect(() => {
    if (!contract) return;

    const interval = setInterval(() => {
      loadSystemStats();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [contract, loadSystemStats]);

  // Add alert to system
  const addAlert = (message, type) => {
    const alert = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };

    setRealtimeData(prev => ({
      ...prev,
      alerts: [alert, ...prev.alerts.slice(0, 9)] // Keep last 10
    }));
  };

  // Prepare chart data
  const poolData = [
    { name: 'Sponsor (40%)', value: systemStats.poolBalances[0] || 0, color: COLORS.sponsor },
    { name: 'Level (10%)', value: systemStats.poolBalances[1] || 0, color: COLORS.level },
    { name: 'Upline (10%)', value: systemStats.poolBalances[2] || 0, color: COLORS.upline },
    { name: 'Leader (10%)', value: systemStats.poolBalances[3] || 0, color: COLORS.leader },
    { name: 'GHP (30%)', value: systemStats.poolBalances[4] || 0, color: COLORS.ghp }
  ];

  const recentRegistrations = realtimeData.registrations.slice(0, 10).map(reg => ({
    time: new Date(reg.timestamp).toLocaleTimeString(),
    count: 1,
    packageTier: reg.packageTier
  }));

  return (
    <div className="orphi-dashboard">
      <div className="dashboard-header">
        <h1>Orphi CrowdFund - Live Dashboard</h1>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <span className="last-update">
            Last update: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* System Overview */}
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Members</h3>
          <div className="metric-value">{systemStats.totalMembers.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <h3>Total Volume</h3>
          <div className="metric-value">{parseFloat(systemStats.totalVolume).toLocaleString()} USDT</div>
        </div>
        <div className="metric-card">
          <h3>Daily Registrations</h3>
          <div className="metric-value">{systemStats.dailyRegistrations}</div>
        </div>
        <div className="metric-card">
          <h3>Daily Withdrawals</h3>
          <div className="metric-value">{systemStats.dailyWithdrawals}</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container">
          <h3>Pool Balances Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={poolData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${parseFloat(value).toFixed(2)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {poolData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [parseFloat(value).toFixed(4), "USDT"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3>Recent Registration Activity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={recentRegistrations}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Real-time Activity */}
      <div className="activity-section">
        <div className="activity-panel">
          <h3>Recent Registrations</h3>
          <div className="activity-list">
            {realtimeData.registrations.slice(0, 5).map(reg => (
              <div key={reg.id} className="activity-item">
                <span className="activity-time">
                  {new Date(reg.timestamp).toLocaleTimeString()}
                </span>
                <span className="activity-details">
                  User #{reg.userId} registered (Package: ${[30, 50, 100, 200][reg.packageTier - 1] || 'Unknown'})
                </span>
                <span className="activity-address">
                  {reg.user.slice(0, 8)}...{reg.user.slice(-6)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="activity-panel">
          <h3>Recent Withdrawals</h3>
          <div className="activity-list">
            {realtimeData.withdrawals.slice(0, 5).map(withdrawal => (
              <div key={withdrawal.id} className="activity-item">
                <span className="activity-time">
                  {new Date(withdrawal.timestamp).toLocaleTimeString()}
                </span>
                <span className="activity-details">
                  {parseFloat(withdrawal.amount).toFixed(2)} USDT withdrawn
                </span>
                <span className="activity-address">
                  {withdrawal.user.slice(0, 8)}...{withdrawal.user.slice(-6)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts Panel */}
      <div className="alerts-section">
        <h3>System Alerts</h3>
        <div className="alerts-container">
          {realtimeData.alerts.map(alert => (
            <div key={alert.id} className={`alert alert-${alert.type}`}>
              <span className="alert-time">{alert.timestamp}</span>
              <span className="alert-message">{alert.message}</span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .orphi-dashboard {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e0e0e0;
        }

        .connection-status {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
        }

        .status-indicator {
          font-weight: bold;
        }

        .last-update {
          font-size: 0.9em;
          color: #666;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .metric-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .metric-card h3 {
          margin: 0 0 10px 0;
          color: #666;
          font-size: 0.9em;
          text-transform: uppercase;
        }

        .metric-value {
          font-size: 2em;
          font-weight: bold;
          color: #333;
        }

        .charts-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 30px;
        }

        .chart-container {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .chart-container h3 {
          margin: 0 0 20px 0;
          color: #333;
        }

        .activity-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 30px;
        }

        .activity-panel {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .activity-panel h3 {
          margin: 0 0 15px 0;
          color: #333;
        }

        .activity-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .activity-item {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
          font-size: 0.9em;
        }

        .activity-time {
          color: #666;
          font-weight: bold;
        }

        .activity-details {
          color: #333;
        }

        .activity-address {
          color: #007bff;
          font-family: monospace;
        }

        .alerts-section {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .alerts-section h3 {
          margin: 0 0 15px 0;
          color: #333;
        }

        .alerts-container {
          max-height: 200px;
          overflow-y: auto;
        }

        .alert {
          display: flex;
          justify-content: space-between;
          padding: 10px;
          margin-bottom: 5px;
          border-radius: 4px;
          font-size: 0.9em;
        }

        .alert-info {
          background: #d1ecf1;
          border-left: 4px solid #bee5eb;
        }

        .alert-success {
          background: #d4edda;
          border-left: 4px solid #c3e6cb;
        }

        .alert-error {
          background: #f8d7da;
          border-left: 4px solid #f5c6cb;
        }

        .alert-time {
          font-weight: bold;
          color: #666;
        }

        @media (max-width: 768px) {
          .charts-section,
          .activity-section {
            grid-template-columns: 1fr;
          }
          
          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
};

export default OrphiDashboard;
