import React, { useState, useEffect } from 'react';
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
  Bar,
  AreaChart,
  Area
} from 'recharts';
import './TeamAnalyticsDashboard.css';

/**
 * OrphiChain Team Analytics Dashboard
 * Brand-compliant comprehensive team performance tracking and visualization
 * Features:
 * - Real-time team metrics with OrphiChain styling
 * - Interactive charts using brand color palette
 * - Performance tracking and growth analytics
 * - Leadership scoring and retention metrics
 * - Mobile-responsive design
 * - Export functionality for reports
 */

const TeamAnalyticsDashboard = ({ 
  contractInstance, 
  userAddress, 
  demoMode = false,
  className = "",
  refreshInterval = 30000 // 30 seconds
}) => {
  const [teamData, setTeamData] = useState(null);
  const [networkMetrics, setNetworkMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [activeMetric, setActiveMetric] = useState('volume');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // OrphiChain brand colors for charts
  const ORPHI_COLORS = {
    primary: '#00D4FF',
    secondary: '#7B2CBF',
    accent: '#FF6B35',
    success: '#00FF88',
    warning: '#FFD700',
    danger: '#FF4757',
    gradient: ['#00D4FF', '#7B2CBF', '#FF6B35'],
    chart: ['#00D4FF', '#7B2CBF', '#FF6B35', '#00FF88', '#FFD700', '#FF4757']
  };

  // Load team analytics data
  useEffect(() => {
    if (!contractInstance || !userAddress) return;

    const loadTeamData = async () => {
      setLoading(true);
      try {
        const [analytics, metrics] = await Promise.all([
          contractInstance.getTeamAnalytics(userAddress),
          contractInstance.getUserNetworkMetrics(userAddress)
        ]);

        // Transform analytics data
        const transformedAnalytics = {
          totalTeamSize: Number(analytics.totalTeamSize),
          activeMembers: Number(analytics.activeMembers),
          newMembersLast30: Number(analytics.newMembersLast30),
          teamVolume30d: Number(analytics.teamVolume30d),
          teamEarnings30d: Number(analytics.teamEarnings30d),
          levelDistribution: analytics.levelDistribution.map(Number),
          dailyActivity: analytics.dailyActivity.map(Number),
          topPerformers: analytics.topPerformers,
          performerVolumes: analytics.performerVolumes.map(Number)
        };

        // Transform metrics data
        const transformedMetrics = {
          networkDepth: Number(metrics.networkDepth),
          networkWidth: Number(metrics.networkWidth),
          networkDensity: Number(metrics.networkDensity),
          averageTeamSize: Number(metrics.averageTeamSize),
          leadershipIndex: Number(metrics.leadershipIndex),
          growthRate30d: Number(metrics.growthRate30d),
          retentionRate: Number(metrics.retentionRate)
        };

        setTeamData(transformedAnalytics);
        setNetworkMetrics(transformedMetrics);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to load team analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeamData();
    const interval = setInterval(loadTeamData, refreshInterval);
    return () => clearInterval(interval);
  }, [contractInstance, userAddress, refreshInterval]);

  // Generate daily activity chart data
  const getDailyActivityData = () => {
    if (!teamData) return [];
    
    return teamData.dailyActivity.map((activity, index) => ({
      day: `Day ${30 - index}`,
      activity,
      date: new Date(Date.now() - (30 - index) * 24 * 60 * 60 * 1000)
    })).reverse();
  };

  // Generate level distribution chart data
  const getLevelDistributionData = () => {
    if (!teamData) return [];
    
    return teamData.levelDistribution.map((count, index) => ({
      level: `Level ${index + 1}`,
      members: count,
      percentage: teamData.totalTeamSize > 0 ? (count / teamData.totalTeamSize * 100).toFixed(1) : 0
    }));
  };

  // Generate top performers data
  const getTopPerformersData = () => {
    if (!teamData) return [];
    
    return teamData.topPerformers.map((address, index) => ({
      address: `${address.slice(0, 6)}...${address.slice(-4)}`,
      volume: teamData.performerVolumes[index] / 1e6, // Convert to millions
      rank: index + 1
    }));
  };

  // Calculate growth metrics
  const getGrowthMetrics = () => {
    if (!teamData || !networkMetrics) return {};
    
    const activityRate = teamData.totalTeamSize > 0 ? (teamData.activeMembers / teamData.totalTeamSize * 100) : 0;
    const newMemberRate = teamData.totalTeamSize > 0 ? (teamData.newMembersLast30 / teamData.totalTeamSize * 100) : 0;
    
    return {
      activityRate: activityRate.toFixed(1),
      newMemberRate: newMemberRate.toFixed(1),
      avgVolume: teamData.totalTeamSize > 0 ? (teamData.teamVolume30d / teamData.totalTeamSize / 1e6).toFixed(2) : 0
    };
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="orphi-tooltip custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`team-analytics-dashboard ${className} orphi-card-dark`}>
        <div className="loading-container">
          <div className="orphi-spinner"></div>
          <p className="orphi-text">Loading team analytics...</p>
        </div>
      </div>
    );
  }

  if (!teamData || !networkMetrics) {
    return (
      <div className={`team-analytics-dashboard ${className} orphi-card-dark`}>
        <div className="error-container">
          <h3 className="orphi-h3">No Data Available</h3>
          <p className="orphi-text">Unable to load team analytics data.</p>
        </div>
      </div>
    );
  }

  const growthMetrics = getGrowthMetrics();

  return (
    <div className={`team-analytics-dashboard ${className} orphi-theme-dark`}>
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h2 className="orphi-h2 dashboard-title">Team Analytics Dashboard</h2>
          <div className="header-actions">
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="orphi-select time-range-selector"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
            <button className="orphi-btn orphi-btn-secondary refresh-btn" onClick={() => window.location.reload()}>
              <span>🔄</span> Refresh
            </button>
          </div>
        </div>
        <div className="last-update">
          <span className="orphi-caption">Last updated: {lastUpdate.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="metrics-grid orphi-grid orphi-grid-cols-4 orphi-gap-lg">
        <div className="orphi-metric-card">
          <div className="orphi-metric-value">{teamData.totalTeamSize}</div>
          <div className="orphi-metric-label">Total Team Size</div>
          <div className="metric-change positive">
            +{teamData.newMembersLast30} this month
          </div>
        </div>
        
        <div className="orphi-metric-card">
          <div className="orphi-metric-value">{growthMetrics.activityRate}%</div>
          <div className="orphi-metric-label">Activity Rate</div>
          <div className="metric-change">
            {teamData.activeMembers} active members
          </div>
        </div>
        
        <div className="orphi-metric-card">
          <div className="orphi-metric-value">${(teamData.teamVolume30d / 1e6).toFixed(1)}M</div>
          <div className="orphi-metric-label">30d Volume</div>
          <div className="metric-change positive">
            +{networkMetrics.growthRate30d.toFixed(1)}% growth
          </div>
        </div>
        
        <div className="orphi-metric-card">
          <div className="orphi-metric-value">{networkMetrics.leadershipIndex}</div>
          <div className="orphi-metric-label">Leadership Index</div>
          <div className="metric-change">
            {networkMetrics.retentionRate.toFixed(1)}% retention
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section orphi-grid orphi-grid-cols-2 orphi-gap-lg">
        {/* Daily Activity Chart */}
        <div className="orphi-card chart-container">
          <h3 className="orphi-h3">Daily Activity (30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={getDailyActivityData()}>
              <defs>
                <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ORPHI_COLORS.primary} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={ORPHI_COLORS.primary} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
              <XAxis 
                dataKey="day" 
                tick={{ fill: '#B8C5D1', fontSize: 12 }}
                axisLine={{ stroke: '#2D3748' }}
              />
              <YAxis 
                tick={{ fill: '#B8C5D1', fontSize: 12 }}
                axisLine={{ stroke: '#2D3748' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="activity"
                stroke={ORPHI_COLORS.primary}
                fillOpacity={1}
                fill="url(#activityGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Level Distribution Chart */}
        <div className="orphi-card chart-container">
          <h3 className="orphi-h3">Team Level Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={getLevelDistributionData()}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="members"
                label={({ name, percentage }) => `${name}: ${percentage}%`}
              >
                {getLevelDistributionData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={ORPHI_COLORS.chart[index % ORPHI_COLORS.chart.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Performers Chart */}
        <div className="orphi-card chart-container">
          <h3 className="orphi-h3">Top Performers (Volume)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={getTopPerformersData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
              <XAxis 
                dataKey="address" 
                tick={{ fill: '#B8C5D1', fontSize: 10 }}
                axisLine={{ stroke: '#2D3748' }}
              />
              <YAxis 
                tick={{ fill: '#B8C5D1', fontSize: 12 }}
                axisLine={{ stroke: '#2D3748' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="volume" fill={ORPHI_COLORS.secondary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Network Metrics */}
        <div className="orphi-card metrics-summary">
          <h3 className="orphi-h3">Network Metrics</h3>
          <div className="metrics-list">
            <div className="metric-row">
              <span className="metric-name">Network Depth:</span>
              <span className="metric-value">{networkMetrics.networkDepth} levels</span>
            </div>
            <div className="metric-row">
              <span className="metric-name">Network Width:</span>
              <span className="metric-value">{networkMetrics.networkWidth} members</span>
            </div>
            <div className="metric-row">
              <span className="metric-name">Network Density:</span>
              <span className="metric-value">{networkMetrics.networkDensity.toFixed(1)}%</span>
            </div>
            <div className="metric-row">
              <span className="metric-name">Average Team Size:</span>
              <span className="metric-value">{networkMetrics.averageTeamSize.toFixed(1)}</span>
            </div>
            <div className="metric-row">
              <span className="metric-name">Growth Rate (30d):</span>
              <span className="metric-value growth-positive">+{networkMetrics.growthRate30d.toFixed(1)}%</span>
            </div>
            <div className="metric-row">
              <span className="metric-name">Retention Rate:</span>
              <span className="metric-value">{networkMetrics.retentionRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* === LEADER POOL & CAP STATUS PANEL === */}
      <div className="orphi-card orphi-theme-dark" style={{margin: '2rem 0', padding: '1.5rem'}}>
        <h3 className="orphi-h3">Leader Pool Share & Earnings Cap</h3>
        <div className="leader-cap-grid" style={{display:'flex',gap:'2rem',flexWrap:'wrap'}}>
          <div>
            <b>Leader Pool Distribution</b> <span title="Bi-monthly, 50/50 split between Shining/Silver Stars">🛈</span>
            <ul style={{margin:'0.5rem 0 0 1rem',color:'#b8c5d1'}}>
              <li>Shining Star: 50% (Team 250+, 10+ directs)</li>
              <li>Silver Star: 50% (Team 500+, any directs)</li>
            </ul>
          </div>
          <div>
            <b>Earnings Cap</b> <span title="Maximum 4x of total investment">🛈</span>
            <div style={{marginTop:'0.5rem',color:'#FFD700'}}>
              {/* Example: show capped status if available */}
              {teamData && teamData.isCapped !== undefined ? (
                <span>Status: <b>{teamData.isCapped ? 'Capped' : 'Active'}</b></span>
              ) : <span>Login to see your cap status.</span>}
              <br/>
              <span>Cap: 4x of total invested</span>
            </div>
          </div>
        </div>
      </div>

      {/* Export Actions */}
      <div className="export-actions">
        <button className="orphi-btn orphi-btn-primary">
          📊 Export PDF Report
        </button>
        <button className="orphi-btn orphi-btn-secondary">
          📋 Export CSV Data
        </button>
        <button className="orphi-btn orphi-btn-ghost">
          📧 Email Report
        </button>
      </div>
    </div>
  );
};

export default TeamAnalyticsDashboard;
