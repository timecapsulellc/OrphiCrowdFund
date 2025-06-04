import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { ethers } from 'ethers';
import './OrphiChain.css';
import OrphiChainLogo from './OrphiChainLogo';

// Lazy load heavy components for code splitting
const ChartsBundle = React.lazy(() => import('./ChartsBundle'));
const GenealogyTreeBundle = React.lazy(() => import('./GenealogyTreeBundle'));
const ExportPanel = React.lazy(() => import('./ExportPanel'));

/**
 * OrphiDashboard Component
 *
 * @component
 * @param {string} [contractAddress] - (Optional) Address of the OrphiChain contract for live data
 * @param {object} [provider] - (Optional) ethers.js provider for contract connection
 * @param {string} [userAddress] - (Optional) Current user address (for future features)
 * @param {boolean} [demoMode=false] - If true, loads mock data for local development/testing
 *
 * Usage:
 *   <OrphiDashboard demoMode={true} />   // Local development with mock data
 *   <OrphiDashboard contractAddress={...} provider={...} /> // Live contract data
 *
 * Features:
 * - Live system statistics with OrphiChain branding
 * - User activity monitoring
 * - Pool balance tracking
 * - Registration trends
 * - Alert system for anomalies
 * - Brand-compliant UI following OrphiChain design guidelines
 *
 * Best Practices:
 * - State is logically grouped and commented for clarity and maintainability.
 * - Demo mode provides realistic mock data for all dashboard sections.
 * - Data loading/event logic is separated from UI rendering.
 * - All errors are caught and surfaced to the user via the alert system.
 * - ExportPanel receives all relevant data for export.
 * - Utility functions are concise, documented, and modular.
 * - Code is highly maintainable, extensible, and easy for new developers to understand and extend.
 *
 * For more details, see CONTRIBUTING.md and LOCAL_DEVELOPMENT_GUIDE.md.
 */

const ORPHI_COLORS = {
  primary: '#00D4FF',      // Cyber Blue
  secondary: '#7B2CBF',    // Royal Purple
  accent: '#FF6B35',       // Energy Orange
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.7)'
};

// Responsive breakpoints for adaptive dashboard
const BREAKPOINTS = {
  mobile: '480px',
  tablet: '768px',
  laptop: '1024px',
  desktop: '1280px'
};

const OrphiDashboard = ({ contractAddress, provider, userAddress, demoMode = false }) => {
  // --- System-wide statistics (from contract or demo) ---
  const [systemStats, setSystemStats] = useState({
    totalMembers: 0,
    totalVolume: 0,
    poolBalances: [0, 0, 0, 0, 0],
    lastGHPDistribution: 0,
    dailyRegistrations: 0,
    dailyWithdrawals: 0
  });

  // --- Real-time event data (registrations, withdrawals, alerts) ---
  const [realtimeData, setRealtimeData] = useState({
    registrations: [],
    withdrawals: [],
    poolHistory: [],
    alerts: []
  });

  // --- Contract connection state ---
  const [contract, setContract] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  // --- Genealogy tree state ---
  const [treeExpanded, setTreeExpanded] = useState(false);
  const [selectedTreeUser, setSelectedTreeUser] = useState('');
  const [networkTreeData, setNetworkTreeData] = useState({
    name: 'OrphiChain Network',
    attributes: {
      address: 'Root',
      packageTier: null
    },
    children: []
  });

  // Theme (dark or light)
  const [theme, setTheme] = useState('dark');
  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Loading state
  const [loading, setLoading] = useState(true);

  // 1. Add state for genealogy tree minimap and search/filter
  const [treeMinimapVisible, setTreeMinimapVisible] = useState(false);
  const [treeSearch, setTreeSearch] = useState('');
  const [treeSearchResults, setTreeSearchResults] = useState([]);
  const [showGrowthTrends, setShowGrowthTrends] = useState(true);
  const [showMyStats, setShowMyStats] = useState(true);
  const [showGenealogy, setShowGenealogy] = useState(true);
  const [showActivity, setShowActivity] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);

  // --- Persistent user preferences ---
  useEffect(() => {
    // Load theme and panel preferences from localStorage
    const savedTheme = localStorage.getItem('orphi-theme');
    if (savedTheme) setTheme(savedTheme);
    const savedPanels = localStorage.getItem('orphi-panels');
    if (savedPanels) {
      const panels = JSON.parse(savedPanels);
      setShowGrowthTrends(panels.growthTrends ?? true);
      setShowMyStats(panels.myStats ?? true);
      setShowGenealogy(panels.genealogy ?? true);
      setShowActivity(panels.activity ?? true);
      setShowAlerts(panels.alerts ?? true);
    }
  }, []);

  useEffect(() => {
    // Persist theme and panel preferences
    localStorage.setItem('orphi-theme', theme);
    localStorage.setItem('orphi-panels', JSON.stringify({
      growthTrends: showGrowthTrends,
      myStats: showMyStats,
      genealogy: showGenealogy,
      activity: showActivity,
      alerts: showAlerts
    }));
  }, [theme, showGrowthTrends, showMyStats, showGenealogy, showActivity, showAlerts]);

  // --- Onboarding/help modal ---
  const [showHelp, setShowHelp] = useState(false);
  const onboardingText = `Welcome to the OrphiChain Dashboard!\n\n- Use the top buttons to show/hide dashboard panels.\n- Use the theme toggle for dark/light mode.\n- Search and focus on users in the genealogy tree.\n- Click nodes in the minimap to navigate the tree.\n- Export data using the Export Options panel.\n- All settings are saved for your next visit.\n\nFor more, see the documentation or contact support.`;

  // Initialize contract connection or demo mode
  useEffect(() => {
    if (demoMode) {
      // DEMO MODE: Load mock data for all dashboard sections
      loadDemoData();
      return;
    }
    // LIVE MODE: Connect to contract and subscribe to events
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
  }, [contractAddress, provider, demoMode]);

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

  // Simulate loading for demo and live data
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, [systemStats, realtimeData]);

  // --- Utility: Add alert to system ---
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

  // --- Utility: Load demo data for all dashboard sections ---
  const loadDemoData = () => {
    setSystemStats({
      totalMembers: 1247,
      totalVolume: "45678.50",
      poolBalances: ["15000.25", "3500.75", "4200.50", "3800.00", "12000.00"],
      lastGHPDistribution: 1000,
      dailyRegistrations: 23,
      dailyWithdrawals: 8
    });

    const demoRegistrations = [
      { id: '1', timestamp: Date.now() - 300000, user: '0x1234...5678', sponsor: 'Root', packageTier: 2, userId: 1245 },
      { id: '2', timestamp: Date.now() - 600000, user: '0x2345...6789', sponsor: '0x1234...5678', packageTier: 3, userId: 1246 },
      { id: '3', timestamp: Date.now() - 900000, user: '0x3456...7890', sponsor: '0x2345...6789', packageTier: 1, userId: 1247 }
    ];

    const demoWithdrawals = [
      { id: '1', timestamp: Date.now() - 400000, user: '0x1234...5678', amount: '150.50' },
      { id: '2', timestamp: Date.now() - 800000, user: '0x2345...6789', amount: '75.25' }
    ];

    setRealtimeData({
      registrations: demoRegistrations,
      withdrawals: demoWithdrawals,
      poolHistory: [],
      alerts: [
        { id: 1, message: 'Demo mode active - showing sample data', type: 'info', timestamp: new Date().toLocaleTimeString() }
      ]
    });

    setIsConnected(true);
    setLastUpdate(new Date());
  };

  // Prepare chart data with OrphiChain colors
  const poolData = [
    { name: 'Sponsor (40%)', value: systemStats.poolBalances[0] || 0, color: ORPHI_COLORS.primary },
    { name: 'Level (10%)', value: systemStats.poolBalances[1] || 0, color: ORPHI_COLORS.secondary },
    { name: 'Upline (10%)', value: systemStats.poolBalances[2] || 0, color: ORPHI_COLORS.accent },
    { name: 'Leader (10%)', value: systemStats.poolBalances[3] || 0, color: ORPHI_COLORS.success },
    { name: 'GHP (30%)', value: systemStats.poolBalances[4] || 0, color: ORPHI_COLORS.warning }
  ];

  // Build network tree data from registrations
  const buildNetworkTree = useCallback(() => {
    const userMap = new Map();
    const rootNode = {
      name: 'OrphiChain Network',
      attributes: {
        address: 'Root',
        packageTier: null
      },
      children: []
    };

    // Create user nodes from registrations
    realtimeData.registrations.forEach(reg => {
      const userNode = {
        name: `User #${reg.userId}`,
        attributes: {
          address: reg.user,
          packageTier: reg.packageTier,
          sponsor: reg.sponsor,
          timestamp: reg.timestamp
        },
        children: []
      };
      userMap.set(reg.user, userNode);
    });

    // Build tree structure based on sponsor relationships
    const addedToTree = new Set();
    
    realtimeData.registrations.forEach(reg => {
      const userNode = userMap.get(reg.user);
      if (!userNode || addedToTree.has(reg.user)) return;

      // Find sponsor in the map
      const sponsorNode = userMap.get(reg.sponsor);
      
      if (sponsorNode && !addedToTree.has(reg.sponsor)) {
        // Add sponsor to tree first if not already added
        if (reg.sponsor !== 'Root') {
          sponsorNode.children = sponsorNode.children || [];
          rootNode.children.push(sponsorNode);
          addedToTree.add(reg.sponsor);
        }
      }

      // Add user under sponsor or root
      if (sponsorNode && sponsorNode.children) {
        sponsorNode.children.push(userNode);
      } else {
        rootNode.children.push(userNode);
      }
      addedToTree.add(reg.user);
    });

    setNetworkTreeData(rootNode);
  }, [realtimeData.registrations]);

  // Update tree when registrations change
  useEffect(() => {
    buildNetworkTree();
  }, [buildNetworkTree]);

  // Utility to focus on specific user in tree
  const focusOnTreeUser = useCallback((userId) => {
    if (!userId) return;
    
    // Find the user in the tree and center view
    setSelectedTreeUser(userId);
    
    // In a real implementation, you would add code here to:
    // 1. Traverse the tree to find the node
    // 2. Center the view on that node
    // 3. Expand relevant branches
    
    addAlert(`Focused on user ${userId.slice(0, 8)}...`, "info");
  }, []);

  const recentRegistrations = realtimeData.registrations.slice(0, 10).map(reg => ({
    time: new Date(reg.timestamp).toLocaleTimeString(),
    count: 1,
    packageTier: reg.packageTier
  }));

  // 2. Add genealogy tree search/filter logic
  const handleTreeSearch = useCallback((query) => {
    setTreeSearch(query);
    if (!query) {
      setTreeSearchResults([]);
      return;
    }
    // Search by userId or address
    const results = realtimeData.registrations.filter(reg =>
      reg.userId.toString().includes(query) ||
      reg.user.toLowerCase().includes(query.toLowerCase())
    );
    setTreeSearchResults(results);
  }, [realtimeData.registrations]);

  // 3. Add analytics: Growth Trends data
  const growthTrendsData = realtimeData.registrations.slice(-30).map(reg => ({
    date: new Date(reg.timestamp).toLocaleDateString(),
    volume: parseFloat(systemStats.totalVolume),
    registrations: 1
  }));

  // 4. My Stats panel (if userAddress)
  const myStats = userAddress ? {
    registrations: realtimeData.registrations.filter(r => r.user === userAddress).length,
    withdrawals: realtimeData.withdrawals.filter(w => w.user === userAddress).length,
    tier: realtimeData.registrations.find(r => r.user === userAddress)?.packageTier || null
  } : null;

  // --- Personalization: Panel toggles
  const handlePanelToggle = (panel) => {
    if (panel === 'growthTrends') setShowGrowthTrends(v => !v);
    if (panel === 'myStats') setShowMyStats(v => !v);
    if (panel === 'genealogy') setShowGenealogy(v => !v);
    if (panel === 'activity') setShowActivity(v => !v);
    if (panel === 'alerts') setShowAlerts(v => !v);
  };

  // --- Genealogy tree: search highlight and minimap interactivity ---
  const treeRef = React.useRef();
  const minimapRef = React.useRef();

  useEffect(() => {
    // If search results, auto-focus/zoom to the first found node
    if (treeSearchResults.length && treeRef.current) {
      // Use react-d3-tree API to center/zoom to node (pseudo-code, actual API may differ)
      // treeRef.current.centerNode(treeSearchResults[0]);
      // For now, just alert user
      addAlert(`Found user: ${treeSearchResults[0].user}`, 'info');
    }
  }, [treeSearchResults]);

  const handleMinimapNodeClick = (nodeDatum) => {
    // Center/zoom main tree to this node (pseudo-code)
    // treeRef.current.centerNode(nodeDatum);
    addAlert(`Minimap: focused on ${nodeDatum.name}`, 'info');
  };

  // --- Genealogy Tree Stats Popover ---
  const [showTreeStats, setShowTreeStats] = useState(false);
  const treeStats = {
    totalUsers: networkTreeData.children?.length || 0,
    totalVolume: systemStats.totalVolume,
    maxDepth: 3, // Example, replace with real calculation if available
    directChildren: networkTreeData.children?.length || 0
  };

  return (
    <div className="orphi-dashboard" data-theme={theme}>
      {/* Onboarding/help modal */}
      {showHelp && (
        <div className="onboarding-modal" role="dialog" aria-modal="true" tabIndex={-1}>
          <div className="onboarding-content">
            <h2>Welcome!</h2>
            <pre>{onboardingText}</pre>
            <button onClick={() => setShowHelp(false)} autoFocus>Close</button>
          </div>
        </div>
      )}
      <button className="help-btn" onClick={() => setShowHelp(true)} aria-label="Show help and onboarding">❓ Help</button>
      {/* Theme toggle (with ARIA) */}
      <button 
        className="theme-toggle-btn"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggleTheme(); }}
      >
        {theme === 'dark' ? '🌞 Light Mode' : '🌜 Dark Mode'}
      </button>
      {/* === HEADER: Branding, Title, Connection Status === */}
      <div className="dashboard-header">
        <div className="header-content">
          <OrphiChainLogo size="large" variant="hexagonal" autoRotate={true} backgroundColor={theme} />
          <div className="title-section">
            <h1 className="main-title">OrphiChain</h1>
            <h2 className="sub-title">CrowdFund Live Dashboard</h2>
            <p className="dashboard-description">Real-time network monitoring and analytics</p>
          </div>
          <div className="connection-status" aria-live="polite">
            <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}> 
              <div className="status-dot"></div>
              <span className="status-text">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <span className="last-update">
              Last update: {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* === METRICS GRID: System Overview === */}
      <div className="metrics-grid" role="region" aria-label="System Overview Metrics">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div className="metric-card metric-skeleton" key={i} aria-hidden="true">
              <div className="skeleton-title shimmer"></div>
              <div className="skeleton-value shimmer"></div>
            </div>
          ))
        ) : (
          <>
            <div className="metric-card" title="Total registered members in the OrphiChain network">
              <h3>Total Members</h3>
              <div className="metric-value" aria-live="polite">{systemStats.totalMembers.toLocaleString()}</div>
            </div>
            <div className="metric-card" title="Total volume of transactions in USDT">
              <h3>Total Volume</h3>
              <div className="metric-value" aria-live="polite">{parseFloat(systemStats.totalVolume).toLocaleString()} USDT</div>
            </div>
            <div className="metric-card" title="New registrations in the last 24 hours">
              <h3>Daily Registrations</h3>
              <div className="metric-value" aria-live="polite">{systemStats.dailyRegistrations}</div>
            </div>
            <div className="metric-card" title="Withdrawals processed in the last 24 hours">
              <h3>Daily Withdrawals</h3>
              <div className="metric-value" aria-live="polite">{systemStats.dailyWithdrawals}</div>
            </div>
          </>
        )}
      </div>

      {/* === CHARTS SECTION: Pool Balances & Registration Activity === */}
      <Suspense fallback={
        <div className="charts-section">
          <div className="chart-skeleton shimmer" aria-hidden="true" style={{ height: '300px', marginBottom: '2rem' }}>
            <div className="loading-text">Loading Charts...</div>
          </div>
        </div>
      }>
        <ChartsBundle 
          poolData={poolData}
          recentRegistrations={recentRegistrations}
          loading={loading}
          systemStats={systemStats}
          realtimeData={realtimeData}
        />
      </Suspense>

      {/* === GENEALOGY TREE: Network Visualization === */}
      {showGenealogy && (
        <Suspense fallback={
          <div className="genealogy-section">
            <div className="tree-skeleton shimmer" aria-hidden="true" style={{ height: '500px' }}>
              <div className="loading-text">Loading Genealogy Tree...</div>
            </div>
          </div>
        }>
          <GenealogyTreeBundle
            networkTreeData={networkTreeData}
            treeExpanded={treeExpanded}
            setTreeExpanded={setTreeExpanded}
            treeSearch={treeSearch}
            handleTreeSearch={handleTreeSearch}
            selectedTreeUser={selectedTreeUser}
            setSelectedTreeUser={setSelectedTreeUser}
            focusOnTreeUser={focusOnTreeUser}
            realtimeData={realtimeData}
            treeMinimapVisible={treeMinimapVisible}
            setTreeMinimapVisible={setTreeMinimapVisible}
            loading={loading}
            treeSearchResults={treeSearchResults}
            handleMinimapNodeClick={handleMinimapNodeClick}
            addAlert={addAlert}
            showTreeStats={showTreeStats}
            setShowTreeStats={setShowTreeStats}
            treeStats={treeStats}
          />
        </Suspense>
      )}

      {/* === ACTIVITY PANELS: Registrations & Withdrawals === */}
      <div className="activity-section">
        <div className="activity-panel">
          <div className="panel-header">
            <h3>Recent Registrations</h3>
            <div className="activity-count">{realtimeData.registrations.length}</div>
          </div>
          <div className="activity-list">
            {realtimeData.registrations.slice(0, 5).map(reg => (
              <div key={reg.id} className="activity-item">
                <div className="activity-avatar">
                  <div className="avatar-icon">👤</div>
                </div>
                <div className="activity-content">
                  <div className="activity-main">
                    <span className="activity-title">User #{reg.userId} registered</span>
                    <span className={`activity-badge package-tier-${reg.packageTier}`}>
                      ${[30, 50, 100, 200][reg.packageTier - 1] || 'Unknown'}
                    </span>
                  </div>
                  <div className="activity-meta">
                    <span className="activity-time">
                      {new Date(reg.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="activity-address">
                      {reg.user.slice(0, 8)}...{reg.user.slice(-6)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {realtimeData.registrations.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p>No recent registrations</p>
              </div>
            )}
          </div>
        </div>

        <div className="activity-panel">
          <div className="panel-header">
            <h3>Recent Withdrawals</h3>
            <div className="activity-count">{realtimeData.withdrawals.length}</div>
          </div>
          <div className="activity-list">
            {realtimeData.withdrawals.slice(0, 5).map(withdrawal => (
              <div key={withdrawal.id} className="activity-item">
                <div className="activity-avatar">
                  <div className="avatar-icon">💸</div>
                </div>
                <div className="activity-content">
                  <div className="activity-main">
                    <span className="activity-title">
                      {parseFloat(withdrawal.amount).toFixed(2)} USDT withdrawn
                    </span>
                    <span className="activity-badge success">
                      Processed
                    </span>
                  </div>
                  <div className="activity-meta">
                    <span className="activity-time">
                      {new Date(withdrawal.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="activity-address">
                      {withdrawal.user.slice(0, 8)}...{withdrawal.user.slice(-6)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {realtimeData.withdrawals.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">💰</div>
                <p>No recent withdrawals</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === ALERTS PANEL: System Alerts === */}
      <div className="alerts-section" role="log" aria-label="System Alerts">
        <div className="alerts-header">
          <h3>System Alerts</h3>
          <div className="alerts-controls">
            <button 
              className="clear-alerts-btn"
              onClick={() => setRealtimeData(prev => ({ ...prev, alerts: [] }))}
              disabled={realtimeData.alerts.length === 0}
              aria-label="Clear all alerts"
            >
              Clear All
            </button>
          </div>
        </div>
        <div className="alerts-container">
          {realtimeData.alerts.map(alert => (
            <div key={alert.id} className={`alert alert-${alert.type}`}>
              <div className="alert-icon">
                {alert.type === 'success' && '✅'}
                {alert.type === 'info' && 'ℹ️'}
                {alert.type === 'error' && '❌'}
                {alert.type === 'warning' && '⚠️'}
              </div>
              <div className="alert-content">
                <span className="alert-message">{alert.message}</span>
                <span className="alert-time">{alert.timestamp}</span>
              </div>
            </div>
          ))}
          {realtimeData.alerts.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🔔</div>
              <p>No system alerts</p>
            </div>
          )}
        </div>
      </div>

      {/* === EXPORT PANEL: PDF/CSV/Email === */}
      <Suspense fallback={
        <div className="export-panel-skeleton shimmer" aria-hidden="true" style={{ height: '80px', margin: '1rem 0' }}>
          <div className="loading-text">Loading Export Options...</div>
        </div>
      }>
        <ExportPanel 
          data={{
            systemStats,
            realtimeData,
            poolData,
            networkTree: networkTreeData,
            growthTrends: growthTrendsData,
            myStats,
            lastUpdate: lastUpdate.toISOString()
          }}
          filename="orphichain-dashboard-report"
          title="OrphiChain Dashboard Report"
          subtitle={`Generated on ${new Date().toLocaleDateString()}`}
        />
      </Suspense>

      {/* === AUTO-REFRESH INDICATOR === */}
      <div className="refresh-indicator">
        <div className="refresh-status">
          <span className="refresh-icon">🔄</span>
          Auto-refresh: 30s
        </div>
      </div>
    </div>
  );
};

export default OrphiDashboard;

/*
Note: For code-splitting and SVG optimization, see build config (vite.config.js, etc.)
*/
