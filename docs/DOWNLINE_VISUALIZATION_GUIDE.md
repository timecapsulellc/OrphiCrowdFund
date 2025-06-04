# Downline Visualization Implementation Guide

## Overview

This guide provides comprehensive implementation examples for the enhanced downline visualization system. The new endpoints enable advanced network analysis, team performance tracking, and interactive visualization components for the Orphi CrowdFund platform.

## Core Visualization Endpoints

### 1. getDownlineVisualizationData()

**Purpose**: Generate complete network structure data for interactive tree visualizations.

**Implementation Example**:

```javascript
class NetworkVisualization {
    constructor(contractInstance) {
        this.contract = contractInstance;
        this.cache = new Map();
    }

    async fetchNetworkData(userAddress, depth = 5) {
        const cacheKey = `${userAddress}-${depth}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const vizData = await this.contract.getDownlineVisualizationData(userAddress, depth);
            
            // Transform contract data for frontend use
            const transformedData = {
                rootUser: vizData.rootUser,
                totalMembers: Number(vizData.totalMembers),
                totalVolume: ethers.utils.formatEther(vizData.totalVolume),
                activeMembersCount: Number(vizData.activeMembersCount),
                maxDepth: Number(vizData.maxDepth),
                nodes: vizData.nodes.map(node => ({
                    id: node.userAddress,
                    address: node.userAddress,
                    userId: Number(node.userId),
                    level: Number(node.level),
                    directReferrals: Number(node.directReferrals),
                    teamSize: Number(node.teamSize),
                    volume: ethers.utils.formatEther(node.volume),
                    isActive: node.isActive,
                    joinDate: new Date(Number(node.joinDate) * 1000),
                    packageTier: Number(node.packageTier),
                    leaderRank: Number(node.leaderRank),
                    displayName: this.formatAddress(node.userAddress)
                })),
                edges: vizData.connections.map(edge => ({
                    from: edge.from,
                    to: edge.to,
                    weight: ethers.utils.formatEther(edge.weight),
                    establishedDate: new Date(Number(edge.establishedDate) * 1000),
                    packageTier: Number(edge.packageTier)
                }))
            };

            // Cache for 5 minutes
            this.cache.set(cacheKey, transformedData);
            setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

            return transformedData;
        } catch (error) {
            console.error('Error fetching network data:', error);
            throw error;
        }
    }

    formatAddress(address) {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
}
```

### 2. getTeamAnalytics()

**Purpose**: Provide comprehensive team performance metrics for dashboard displays.

**Implementation Example**:

```javascript
class TeamAnalytics {
    constructor(contractInstance) {
        this.contract = contractInstance;
    }

    async getTeamMetrics(userAddress) {
        try {
            const analytics = await this.contract.getTeamAnalytics(userAddress);
            
            return {
                overview: {
                    totalTeamSize: Number(analytics.totalTeamSize),
                    activeMembers: Number(analytics.activeMembers),
                    activityRate: this.calculateActivityRate(analytics),
                    newMembersLast30: Number(analytics.newMembersLast30),
                    growthRate: this.calculateGrowthRate(analytics)
                },
                financial: {
                    teamVolume30d: ethers.utils.formatEther(analytics.teamVolume30d),
                    teamEarnings30d: ethers.utils.formatEther(analytics.teamEarnings30d),
                    averageVolume: this.calculateAverageVolume(analytics)
                },
                structure: {
                    levelDistribution: analytics.levelDistribution.map(Number),
                    maxActiveLevel: this.findMaxActiveLevel(analytics.levelDistribution),
                    balanceIndex: this.calculateBalanceIndex(analytics.levelDistribution)
                },
                performance: {
                    topPerformers: analytics.topPerformers.slice(0, 10),
                    performerVolumes: analytics.performerVolumes.slice(0, 10).map(v => 
                        ethers.utils.formatEther(v)
                    ),
                    dailyActivity: analytics.dailyActivity.map(Number)
                }
            };
        } catch (error) {
            console.error('Error fetching team analytics:', error);
            throw error;
        }
    }

    calculateActivityRate(analytics) {
        const total = Number(analytics.totalTeamSize);
        const active = Number(analytics.activeMembers);
        return total > 0 ? Math.round((active / total) * 100) : 0;
    }

    calculateGrowthRate(analytics) {
        const total = Number(analytics.totalTeamSize);
        const newMembers = Number(analytics.newMembersLast30);
        return total > 0 ? Math.round((newMembers / total) * 100) : 0;
    }

    calculateAverageVolume(analytics) {
        const volume = ethers.utils.formatEther(analytics.teamVolume30d);
        const members = Number(analytics.activeMembers);
        return members > 0 ? (parseFloat(volume) / members).toFixed(2) : '0';
    }

    findMaxActiveLevel(levelDistribution) {
        for (let i = levelDistribution.length - 1; i >= 0; i--) {
            if (Number(levelDistribution[i]) > 0) {
                return i + 1;
            }
        }
        return 0;
    }

    calculateBalanceIndex(levelDistribution) {
        // Calculate how balanced the distribution is across levels
        const levels = levelDistribution.map(Number).filter(count => count > 0);
        if (levels.length <= 1) return 100;
        
        const mean = levels.reduce((sum, count) => sum + count, 0) / levels.length;
        const variance = levels.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / levels.length;
        const standardDeviation = Math.sqrt(variance);
        
        // Return balance score (lower deviation = higher balance)
        return Math.max(0, 100 - Math.round((standardDeviation / mean) * 50));
    }
}
```

## React Components for Visualization

### 1. Interactive Network Tree

```jsx
// components/NetworkTreeVisualization.jsx
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const NetworkTreeVisualization = ({ userAddress, contractInstance, maxDepth = 5 }) => {
    const svgRef = useRef();
    const [networkData, setNetworkData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedNode, setSelectedNode] = useState(null);
    const [filters, setFilters] = useState({
        showInactive: true,
        minTeamSize: 0,
        packageTiers: [1, 2, 3, 4, 5]
    });

    useEffect(() => {
        loadNetworkData();
    }, [userAddress, maxDepth]);

    const loadNetworkData = async () => {
        if (!contractInstance || !userAddress) return;

        setLoading(true);
        try {
            const vizClient = new NetworkVisualization(contractInstance);
            const data = await vizClient.fetchNetworkData(userAddress, maxDepth);
            setNetworkData(data);
            renderNetworkTree(data);
        } catch (error) {
            console.error('Failed to load network data:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderNetworkTree = (data) => {
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const width = 1200;
        const height = 800;
        const margin = { top: 40, right: 40, bottom: 40, left: 40 };

        svg.attr("width", width).attr("height", height);

        // Create hierarchy from flat data
        const hierarchy = d3.stratify()
            .id(d => d.address)
            .parentId(d => {
                const parent = data.edges.find(edge => edge.to === d.address);
                return parent ? parent.from : null;
            })(data.nodes);

        // Create tree layout
        const treeLayout = d3.tree()
            .size([width - margin.left - margin.right, height - margin.top - margin.bottom]);

        const root = treeLayout(hierarchy);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Draw links
        g.selectAll(".link")
            .data(root.links())
            .enter()
            .append("path")
            .attr("class", "link")
            .attr("d", d3.linkVertical()
                .x(d => d.x)
                .y(d => d.y)
            )
            .style("fill", "none")
            .style("stroke", "#999")
            .style("stroke-width", 2);

        // Draw nodes
        const nodes = g.selectAll(".node")
            .data(root.descendants())
            .enter()
            .append("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.x},${d.y})`)
            .style("cursor", "pointer")
            .on("click", (event, d) => setSelectedNode(d.data));

        // Node circles
        nodes.append("circle")
            .attr("r", d => Math.max(8, Math.min(20, d.data.teamSize / 10)))
            .style("fill", d => getNodeColor(d.data))
            .style("stroke", "#fff")
            .style("stroke-width", 2);

        // Node labels
        nodes.append("text")
            .attr("dy", ".35em")
            .attr("x", d => d.children ? -25 : 25)
            .style("text-anchor", d => d.children ? "end" : "start")
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .text(d => d.data.displayName);

        // Team size labels
        nodes.append("text")
            .attr("dy", "1.5em")
            .attr("x", d => d.children ? -25 : 25)
            .style("text-anchor", d => d.children ? "end" : "start")
            .style("font-size", "10px")
            .style("fill", "#666")
            .text(d => `Team: ${d.data.teamSize}`);
    };

    const getNodeColor = (node) => {
        if (!node.isActive) return "#ccc";
        
        switch (node.leaderRank) {
            case 2: return "#gold"; // Silver Star
            case 1: return "#silver"; // Shining Star  
            default: {
                switch (node.packageTier) {
                    case 5: return "#8B0000"; // $350
                    case 4: return "#FF4500"; // $250
                    case 3: return "#FFA500"; // $150
                    case 2: return "#32CD32"; // $100
                    case 1: return "#4169E1"; // $75
                    default: return "#1E90FF"; // $50
                }
            }
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <div className="text-lg">Loading network visualization...</div>
            </div>
        );
    }

    return (
        <div className="network-visualization">
            <div className="controls mb-4">
                <div className="flex gap-4 items-center">
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={filters.showInactive}
                            onChange={(e) => setFilters({...filters, showInactive: e.target.checked})}
                            className="mr-2"
                        />
                        Show Inactive Users
                    </label>
                    
                    <label className="flex items-center">
                        Min Team Size:
                        <input
                            type="number"
                            value={filters.minTeamSize}
                            onChange={(e) => setFilters({...filters, minTeamSize: parseInt(e.target.value)})}
                            className="ml-2 w-20 px-2 py-1 border rounded"
                            min="0"
                        />
                    </label>

                    <button
                        onClick={loadNetworkData}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            <div className="visualization-container">
                <svg ref={svgRef}></svg>
            </div>

            {selectedNode && (
                <NodeDetailsPanel 
                    node={selectedNode} 
                    onClose={() => setSelectedNode(null)}
                    contractInstance={contractInstance}
                />
            )}

            {networkData && (
                <NetworkSummary data={networkData} />
            )}
        </div>
    );
};

const NodeDetailsPanel = ({ node, onClose, contractInstance }) => {
    const [nodeAnalytics, setNodeAnalytics] = useState(null);

    useEffect(() => {
        loadNodeAnalytics();
    }, [node.address]);

    const loadNodeAnalytics = async () => {
        try {
            const analytics = new TeamAnalytics(contractInstance);
            const metrics = await analytics.getTeamMetrics(node.address);
            setNodeAnalytics(metrics);
        } catch (error) {
            console.error('Error loading node analytics:', error);
        }
    };

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-lg p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">User Details</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                    ×
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="font-semibold">Address:</label>
                    <p className="font-mono text-sm break-all">{node.address}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="font-semibold">Team Size:</label>
                        <p>{node.teamSize}</p>
                    </div>
                    <div>
                        <label className="font-semibold">Direct Referrals:</label>
                        <p>{node.directReferrals}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="font-semibold">Package:</label>
                        <p>${[50, 75, 100, 150, 250, 350][node.packageTier - 1] || 'Unknown'}</p>
                    </div>
                    <div>
                        <label className="font-semibold">Volume:</label>
                        <p>${node.volume} USDT</p>
                    </div>
                </div>

                <div>
                    <label className="font-semibold">Status:</label>
                    <span className={`ml-2 px-2 py-1 rounded text-sm ${
                        node.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                        {node.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>

                <div>
                    <label className="font-semibold">Join Date:</label>
                    <p>{node.joinDate.toLocaleDateString()}</p>
                </div>

                {nodeAnalytics && (
                    <div className="border-t pt-4">
                        <h4 className="font-semibold mb-2">Analytics</h4>
                        <div className="space-y-2 text-sm">
                            <div>Activity Rate: {nodeAnalytics.overview.activityRate}%</div>
                            <div>Growth Rate: {nodeAnalytics.overview.growthRate}%</div>
                            <div>Balance Index: {nodeAnalytics.structure.balanceIndex}/100</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const NetworkSummary = ({ data }) => {
    return (
        <div className="mt-4 grid grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded">
                <div className="text-2xl font-bold text-blue-600">{data.totalMembers}</div>
                <div className="text-sm text-blue-500">Total Members</div>
            </div>
            <div className="bg-green-50 p-4 rounded">
                <div className="text-2xl font-bold text-green-600">{data.activeMembersCount}</div>
                <div className="text-sm text-green-500">Active Members</div>
            </div>
            <div className="bg-purple-50 p-4 rounded">
                <div className="text-2xl font-bold text-purple-600">{data.maxDepth}</div>
                <div className="text-sm text-purple-500">Max Depth</div>
            </div>
            <div className="bg-orange-50 p-4 rounded">
                <div className="text-2xl font-bold text-orange-600">${data.totalVolume}</div>
                <div className="text-sm text-orange-500">Total Volume</div>
            </div>
        </div>
    );
};

export default NetworkTreeVisualization;
```

### 2. Team Performance Dashboard

```jsx
// components/TeamPerformanceDashboard.jsx
import React, { useState, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts';

const TeamPerformanceDashboard = ({ userAddress, contractInstance }) => {
    const [analytics, setAnalytics] = useState(null);
    const [networkMetrics, setNetworkMetrics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [timeRange, setTimeRange] = useState('30d');

    useEffect(() => {
        loadPerformanceData();
    }, [userAddress, timeRange]);

    const loadPerformanceData = async () => {
        if (!contractInstance || !userAddress) return;

        setLoading(true);
        try {
            const [teamAnalytics, networkData] = await Promise.all([
                contractInstance.getTeamAnalytics(userAddress),
                contractInstance.getUserNetworkMetrics(userAddress)
            ]);

            const analyticsClient = new TeamAnalytics(contractInstance);
            const processedAnalytics = await analyticsClient.getTeamMetrics(userAddress);
            
            setAnalytics(processedAnalytics);
            setNetworkMetrics({
                networkDepth: Number(networkData.networkDepth),
                networkWidth: Number(networkData.networkWidth),
                networkDensity: Number(networkData.networkDensity) / 100, // Convert from basis points
                averageTeamSize: Number(networkData.averageTeamSize),
                leadershipIndex: Number(networkData.leadershipIndex),
                growthRate30d: Number(networkData.growthRate30d) / 100,
                retentionRate: Number(networkData.retentionRate) / 100
            });
        } catch (error) {
            console.error('Error loading performance data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !analytics) {
        return <div className="flex justify-center items-center h-96">Loading performance data...</div>;
    }

    // Prepare chart data
    const levelDistributionData = analytics.structure.levelDistribution.map((count, index) => ({
        level: `L${index + 1}`,
        members: count
    })).filter(item => item.members > 0);

    const activityData = analytics.performance.dailyActivity.map((activity, index) => ({
        day: `Day ${index + 1}`,
        activity
    }));

    const topPerformersData = analytics.performance.topPerformers.map((address, index) => ({
        address: `${address.slice(0, 6)}...${address.slice(-4)}`,
        volume: parseFloat(analytics.performance.performerVolumes[index])
    }));

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
        <div className="team-performance-dashboard space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Team Performance Dashboard</h2>
                <div className="flex gap-2">
                    {['7d', '30d', '90d'].map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1 rounded ${
                                timeRange === range 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-200 text-gray-700'
                            }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                    title="Team Size"
                    value={analytics.overview.totalTeamSize}
                    change={analytics.overview.growthRate}
                    changeLabel="growth"
                />
                <MetricCard
                    title="Active Members"
                    value={analytics.overview.activeMembers}
                    change={analytics.overview.activityRate}
                    changeLabel="active"
                />
                <MetricCard
                    title="Team Volume (30d)"
                    value={`$${analytics.financial.teamVolume30d}`}
                    change={networkMetrics.growthRate30d * 100}
                    changeLabel="growth"
                />
                <MetricCard
                    title="Network Depth"
                    value={networkMetrics.networkDepth}
                    change={analytics.structure.balanceIndex}
                    changeLabel="balance"
                />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Level Distribution */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4">Team Level Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={levelDistributionData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="level" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="members" fill="#8884d8" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Daily Activity */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4">Daily Activity Trend</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={activityData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="day" />
                            <YAxis />
                            <Tooltip />
                            <Area 
                                type="monotone" 
                                dataKey="activity" 
                                stroke="#82ca9d" 
                                fill="#82ca9d" 
                                fillOpacity={0.6}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Top Performers */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4">Top Performers by Volume</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topPerformersData} layout="horizontal">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="address" type="category" width={80} />
                            <Tooltip />
                            <Bar dataKey="volume" fill="#ffc658" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Network Health Metrics */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4">Network Health</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span>Network Density</span>
                            <div className="w-32 bg-gray-200 rounded-full h-2">
                                <div 
                                    className="bg-green-500 h-2 rounded-full" 
                                    style={{ width: `${networkMetrics.networkDensity}%` }}
                                ></div>
                            </div>
                            <span>{Math.round(networkMetrics.networkDensity)}%</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                            <span>Retention Rate</span>
                            <div className="w-32 bg-gray-200 rounded-full h-2">
                                <div 
                                    className="bg-blue-500 h-2 rounded-full" 
                                    style={{ width: `${networkMetrics.retentionRate * 100}%` }}
                                ></div>
                            </div>
                            <span>{Math.round(networkMetrics.retentionRate * 100)}%</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                            <span>Leadership Index</span>
                            <div className="w-32 bg-gray-200 rounded-full h-2">
                                <div 
                                    className="bg-purple-500 h-2 rounded-full" 
                                    style={{ width: `${Math.min(100, networkMetrics.leadershipIndex / 50)}%` }}
                                ></div>
                            </div>
                            <span>{networkMetrics.leadershipIndex}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Additional Insights */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Network Insights</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                            {Math.round(networkMetrics.averageTeamSize)}
                        </div>
                        <div className="text-sm text-gray-600">Avg Team Size per Member</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                            {analytics.overview.newMembersLast30}
                        </div>
                        <div className="text-sm text-gray-600">New Members (30d)</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                            {networkMetrics.networkWidth}
                        </div>
                        <div className="text-sm text-gray-600">Network Width</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ title, value, change, changeLabel }) => {
    const isPositive = change >= 0;
    
    return (
        <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600 mb-1">{title}</div>
            <div className="text-2xl font-bold">{value}</div>
            <div className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? '↗' : '↘'} {Math.abs(change)}% {changeLabel}
            </div>
        </div>
    );
};

export default TeamPerformanceDashboard;
```

## Integration with Existing Dashboard

```javascript
// Enhanced OrphiDashboard.jsx integration
import NetworkTreeVisualization from './NetworkTreeVisualization';
import TeamPerformanceDashboard from './TeamPerformanceDashboard';

const EnhancedOrphiDashboard = ({ contractAddress, provider, userAddress }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [contract, setContract] = useState(null);

    // ... existing initialization code ...

    const tabs = [
        { id: 'overview', label: 'System Overview' },
        { id: 'network', label: 'Network Visualization' },
        { id: 'team', label: 'Team Analytics' },
        { id: 'monitoring', label: 'Real-time Monitoring' }
    ];

    return (
        <div className="enhanced-orphi-dashboard">
            {/* Tab Navigation */}
            <div className="tab-navigation mb-6">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 mr-2 rounded ${
                            activeTab === tab.id 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-200 text-gray-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div>
                    {/* Existing system overview content */}
                </div>
            )}

            {activeTab === 'network' && (
                <NetworkTreeVisualization
                    userAddress={userAddress}
                    contractInstance={contract}
                    maxDepth={5}
                />
            )}

            {activeTab === 'team' && (
                <TeamPerformanceDashboard
                    userAddress={userAddress}
                    contractInstance={contract}
                />
            )}

            {activeTab === 'monitoring' && (
                <div>
                    {/* Existing real-time monitoring content */}
                </div>
            )}
        </div>
    );
};
```

## Usage Examples

### 1. Basic Network Visualization

```javascript
// Initialize network visualization
const networkViz = new NetworkVisualization(contractInstance);

// Fetch and display network data
const data = await networkViz.fetchNetworkData(userAddress, 3);
console.log(`Network has ${data.totalMembers} members across ${data.maxDepth} levels`);

// Filter active users only
const activeNodes = data.nodes.filter(node => node.isActive);
console.log(`${activeNodes.length} active members out of ${data.nodes.length} total`);
```

### 2. Team Performance Analysis

```javascript
// Initialize team analytics
const teamAnalytics = new TeamAnalytics(contractInstance);

// Get comprehensive metrics
const metrics = await teamAnalytics.getTeamMetrics(userAddress);

// Display growth insights
console.log(`Team Growth: ${metrics.overview.growthRate}% in last 30 days`);
console.log(`Activity Rate: ${metrics.overview.activityRate}%`);
console.log(`Balance Index: ${metrics.structure.balanceIndex}/100`);
```

### 3. Real-time Network Monitoring

```javascript
// Monitor network changes
contractInstance.on('UserRegistered', async (user, sponsor, packageTier) => {
    if (sponsor === userAddress) {
        // Direct referral - update network visualization
        await networkViz.fetchNetworkData(userAddress, 3);
        
        // Update team analytics
        const updatedMetrics = await teamAnalytics.getTeamMetrics(userAddress);
        updateDashboard(updatedMetrics);
    }
});
```

This comprehensive implementation provides a complete foundation for advanced downline visualization and team analytics in the Orphi CrowdFund platform. The system enables real-time network monitoring, interactive visualizations, and detailed performance tracking for enhanced user experience and administrative oversight.
