import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import './NetworkVisualization.css';
import './OrphiChain.css';

/**
 * OrphiChain Brand-Compliant Network Visualization Component
 * Features:
 * - Interactive D3.js network tree with OrphiChain branding
 * - Touch-friendly controls following brand guidelines
 * - Responsive design for all screen sizes
 * - Real-time data updates with brand animations
 * - Advanced filtering and search with brand styling
 * - Follows OrphiChain brand color palette and typography
 */

const NetworkVisualization = ({ 
  contractInstance, 
  userAddress, 
  maxDepth = 5,
  onNodeSelect,
  demoMode = false,
  className = ""
}) => {
  const svgRef = useRef();
  const containerRef = useRef();
  const [networkData, setNetworkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    showInactive: true,
    minVolume: 0,
    packageTier: 'all',
    depthRange: [1, maxDepth]
  });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isMobile, setIsMobile] = useState(false);

  // Responsive design detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });
      }
      checkMobile();
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load network data
  useEffect(() => {
    if (!contractInstance || !userAddress) return;

    const loadNetworkData = async () => {
      setLoading(true);
      try {
        const data = await contractInstance.getDownlineVisualizationData(userAddress, maxDepth);
        
        // Transform for D3
        const transformedData = {
          nodes: data.nodes.map(node => ({
            id: node.userAddress,
            level: Number(node.level),
            teamSize: Number(node.teamSize),
            volume: Number(node.volume),
            isActive: node.isActive,
            packageTier: Number(node.packageTier),
            directReferrals: Number(node.directReferrals),
            joinDate: new Date(Number(node.joinDate) * 1000),
            leaderRank: Number(node.leaderRank)
          })),
          links: data.connections.map(conn => ({
            source: conn.from,
            target: conn.to,
            weight: Number(conn.weight),
            establishedDate: new Date(Number(conn.establishedDate) * 1000)
          })),
          rootUser: data.rootUser,
          totalMembers: Number(data.totalMembers),
          totalVolume: Number(data.totalVolume),
          maxDepth: Number(data.maxDepth)
        };

        setNetworkData(transformedData);
      } catch (error) {
        console.error('Failed to load network data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNetworkData();
  }, [contractInstance, userAddress, maxDepth]);

  // Filter nodes based on search and filters
  const getFilteredData = () => {
    if (!networkData) return { nodes: [], links: [] };

    let filteredNodes = networkData.nodes.filter(node => {
      // Search filter
      if (searchTerm && !node.id.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Activity filter
      if (!filters.showInactive && !node.isActive) {
        return false;
      }

      // Volume filter
      if (node.volume < filters.minVolume) {
        return false;
      }

      // Package tier filter
      if (filters.packageTier !== 'all' && node.packageTier !== parseInt(filters.packageTier)) {
        return false;
      }

      // Depth filter
      if (node.level < filters.depthRange[0] || node.level > filters.depthRange[1]) {
        return false;
      }

      return true;
    });

    // Filter links to only include those between visible nodes
    const visibleNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = networkData.links.filter(link => 
      visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target)
    );

    return { nodes: filteredNodes, links: filteredLinks };
  };

  // D3 Visualization
  useEffect(() => {
    if (!networkData || dimensions.width === 0) return;

    const { nodes, links } = getFilteredData();
    if (nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = dimensions.width;
    const height = dimensions.height || 600;

    // Create responsive zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const g = svg.append('g');

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(isMobile ? 60 : 100))
      .force('charge', d3.forceManyBody().strength(isMobile ? -100 : -200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(isMobile ? 15 : 20));

    // Color scale based on level
    const colorScale = d3.scaleOrdinal()
      .domain(d3.range(0, networkData.maxDepth + 1))
      .range(d3.schemeCategory10);

    // Size scale based on team size
    const sizeScale = d3.scaleLinear()
      .domain(d3.extent(nodes, d => d.teamSize))
      .range(isMobile ? [8, 20] : [10, 30]);

    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('class', 'network-link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.weight / 1000) + 1);

    // Create nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'network-node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Node circles
    node.append('circle')
      .attr('r', d => sizeScale(d.teamSize))
      .attr('fill', d => colorScale(d.level))
      .attr('stroke', d => d.isActive ? '#ffffff' : '#F44336')
      .attr('stroke-width', 3)
      .style('opacity', d => d.isActive ? 1 : 0.6)
      .style('filter', 'drop-shadow(0 0 8px rgba(255,255,255,0.4))');

    // Node labels (responsive)
    node.append('text')
      .attr('class', 'node-label')
      .attr('dy', isMobile ? 30 : 40)
      .attr('text-anchor', 'middle')
      .style('font-size', isMobile ? '14px' : '18px')
      .style('fill', '#fff')
      .style('font-weight', 'bold')
      .style('stroke', '#000')
      .style('stroke-width', '4px')
      .style('paint-order', 'stroke fill')
      .style('filter', 'drop-shadow(0 2px 2px #000)')
      .style('text-shadow', '0 1px 4px #000, 0 0 4px #fff')
      .style('letter-spacing', '1px')
      .style('word-spacing', '2px')
      .style('dominant-baseline', 'middle')
      .style('alignment-baseline', 'middle')
      .text(d => `${d.id.slice(0, isMobile ? 6 : 8)}...`);

    // Team size labels
    node.append('text')
      .attr('class', 'team-size-label')
      .attr('dy', 5)
      .attr('text-anchor', 'middle')
      .style('font-size', isMobile ? '12px' : '16px')
      .style('fill', 'white')
      .style('font-weight', 'bold')
      .style('stroke', '#000')
      .style('stroke-width', '3px')
      .style('paint-order', 'stroke fill')
      .style('filter', 'drop-shadow(0 1px 1px #000)')
      .style('text-shadow', '0 1px 4px #000, 0 0 3px #fff')
      .style('letter-spacing', '1px')
      .style('word-spacing', '1px')
      .style('dominant-baseline', 'middle')
      .style('alignment-baseline', 'middle')
      .text(d => d.teamSize);

    // Node click handler
    node.on('click', (event, d) => {
      setSelectedNode(d);
      if (onNodeSelect) {
        onNodeSelect(d);
      }
      
      // Highlight selected node
      node.selectAll('circle')
        .attr('stroke-width', n => n.id === d.id ? 4 : 2);
    });

    // Tooltip for mobile
    if (isMobile) {
      node.on('touchstart', (event, d) => {
        event.preventDefault();
        showTooltip(event, d);
      });
    } else {
      // Desktop hover tooltip
      node.on('mouseover', (event, d) => {
        showTooltip(event, d);
      }).on('mouseout', hideTooltip);
    }

    function showTooltip(event, d) {
      const tooltip = d3.select('body').append('div')
        .attr('class', 'network-tooltip')
        .style('opacity', 0);

      tooltip.transition()
        .duration(200)
        .style('opacity', .9);

      tooltip.html(`
        <strong>User:</strong> ${d.id}<br/>
        <strong>Level:</strong> ${d.level}<br/>
        <strong>Team Size:</strong> ${d.teamSize}<br/>
        <strong>Volume:</strong> $${(d.volume / 1e6).toFixed(2)}M<br/>
        <strong>Status:</strong> ${d.isActive ? 'Active' : 'Inactive'}<br/>
        <strong>Package:</strong> Tier ${d.packageTier}
      `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    }

    function hideTooltip() {
      d3.selectAll('.network-tooltip').remove();
    }

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
      d3.selectAll('.network-tooltip').remove();
    };

  }, [networkData, dimensions, filters, searchTerm, isMobile]);

  if (loading) {
    return (
      <div className={`network-visualization ${className}`}>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading network data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`network-visualization ${className} ${isMobile ? 'mobile' : 'desktop'}`}>
      {/* Controls Panel */}
      <div className="controls-panel">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search by address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters-section">
          <div className="filter-group">
            <label>
              <input
                type="checkbox"
                checked={filters.showInactive}
                onChange={(e) => setFilters(prev => ({ ...prev, showInactive: e.target.checked }))}
              />
              Show Inactive Users
            </label>
          </div>

          <div className="filter-group">
            <label>Package Tier:</label>
            <select
              value={filters.packageTier}
              onChange={(e) => setFilters(prev => ({ ...prev, packageTier: e.target.value }))}
            >
              <option value="all">All Tiers</option>
              <option value="1">Tier 1 ($30)</option>
              <option value="2">Tier 2 ($50)</option>
              <option value="3">Tier 3 ($100)</option>
              <option value="4">Tier 4 ($200)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Min Volume: ${filters.minVolume}</label>
            <input
              type="range"
              min="0"
              max="10000"
              step="100"
              value={filters.minVolume}
              onChange={(e) => setFilters(prev => ({ ...prev, minVolume: parseInt(e.target.value) }))}
            />
          </div>
        </div>
      </div>

      {/* Visualization Container */}
      <div className="visualization-container" ref={containerRef}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="network-svg"
        />
      </div>

      {/* Legend */}
      <div className="legend">
        <div className="legend-item">
          <div className="legend-circle active"></div>
          <span>Active User</span>
        </div>
        <div className="legend-item">
          <div className="legend-circle inactive"></div>
          <span>Inactive User</span>
        </div>
        <div className="legend-item">
          <div className="legend-line"></div>
          <span>Referral Connection</span>
        </div>
      </div>

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="selected-node-info">
          <h3>Node Details</h3>
          <div className="node-details">
            <p><strong>Address:</strong> {selectedNode.id}</p>
            <p><strong>Level:</strong> {selectedNode.level}</p>
            <p><strong>Team Size:</strong> {selectedNode.teamSize}</p>
            <p><strong>Direct Referrals:</strong> {selectedNode.directReferrals}</p>
            <p><strong>Volume:</strong> ${(selectedNode.volume / 1e6).toFixed(2)}M</p>
            <p><strong>Package Tier:</strong> {selectedNode.packageTier}</p>
            <p><strong>Status:</strong> {selectedNode.isActive ? 'Active' : 'Inactive'}</p>
            <p><strong>Join Date:</strong> {selectedNode.joinDate.toLocaleDateString()}</p>
            {selectedNode.leaderRank > 0 && (
              <p><strong>Leader Rank:</strong> {selectedNode.leaderRank}</p>
            )}
          </div>
          <button 
            className="close-btn"
            onClick={() => setSelectedNode(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Network Stats */}
      {networkData && (
        <div className="network-stats">
          <div className="stat-item">
            <span className="stat-value">{networkData.totalMembers}</span>
            <span className="stat-label">Total Members</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">${(networkData.totalVolume / 1e6).toFixed(1)}M</span>
            <span className="stat-label">Total Volume</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{networkData.maxDepth}</span>
            <span className="stat-label">Max Depth</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkVisualization;
