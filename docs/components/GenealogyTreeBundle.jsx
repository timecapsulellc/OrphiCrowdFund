// GenealogyTreeBundle.jsx - Code-split genealogy tree component
import React, { useState, useRef, useEffect } from 'react';
import Tree from 'react-d3-tree';

const GenealogyTreeBundle = ({
  networkTreeData,
  treeExpanded,
  setTreeExpanded,
  treeSearch,
  handleTreeSearch,
  selectedTreeUser,
  setSelectedTreeUser,
  focusOnTreeUser,
  realtimeData,
  treeMinimapVisible,
  setTreeMinimapVisible,
  loading,
  treeSearchResults,
  handleMinimapNodeClick,
  addAlert,
  showTreeStats,
  setShowTreeStats,
  treeStats,
  orientation = 'vertical' // NEW: orientation prop
}) => {
  const treeRef = useRef();
  const minimapRef = useRef();

  // Validation state for search and selector
  const [searchError, setSearchError] = useState('');
  const [selectorError, setSelectorError] = useState('');

  useEffect(() => {
    // If search results, auto-focus/zoom to the first found node
    if (treeSearchResults.length && treeRef.current) {
      // Use react-d3-tree API to center/zoom to node (pseudo-code, actual API may differ)
      // treeRef.current.centerNode(treeSearchResults[0]);
      // For now, just alert user
      addAlert(`Found user: ${treeSearchResults[0].user}`, 'info');
    }
  }, [treeSearchResults, addAlert]);

  // Enhanced search handler with validation
  const handleValidatedTreeSearch = (query) => {
    if (query && query.length < 3) {
      setSearchError('Enter at least 3 characters to search.');
      handleTreeSearch('');
      return;
    }
    setSearchError('');
    handleTreeSearch(query);
  };

  // Enhanced selector validation
  const handleUserSelect = (value) => {
    if (!value) {
      setSelectorError('Please select a user.');
      setSelectedTreeUser('');
      return;
    }
    setSelectorError('');
    setSelectedTreeUser(value);
    focusOnTreeUser(value);
  };

  // Brand color logic
  const getPackageTierColor = (tier) => {
    const colors = [
      '#FF6B35', // 1: Energy Orange
      '#00D4FF', // 2: Cyber Blue
      '#7B2CBF', // 3: Royal Purple
      '#00FF88'  // 4: Success Green
    ];
    return colors[(tier || 1) - 1] || '#666';
  };

  // Custom node renderer: always two lines (name, then address/tier)
  const renderCustomNode = (rd3tProps) => {
    const { nodeDatum } = rd3tProps;
    const isRoot = nodeDatum.name === 'OrphiChain Network';
    return (
      <g data-tooltip={`Address: ${nodeDatum.attributes?.address} | Tier: ${nodeDatum.attributes?.packageTier}`}
         className={treeSearchResults.some(r => r.user === nodeDatum.attributes?.address) ? 'tree-node-highlight' : ''}
      >
        <circle
          r={20}
          fill={getPackageTierColor(nodeDatum.attributes?.packageTier)}
          stroke="#fff"
          strokeWidth={3}
          style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.4))' }}
          className="tree-node-animated"
          tabIndex={0}
          aria-label={`User node: ${nodeDatum.name}`}
        />
        {/* Line 1: User name/ID */}
        <text
          fill="#fff"
          fontSize="16"
          fontWeight="bold"
          textAnchor="middle"
          y="-2"
          stroke="#000"
          strokeWidth="3"
          paintOrder="stroke fill"
          style={{ filter: 'drop-shadow(0 2px 2px #000)', textShadow: '0 2px 8px #000, 0 0 4px #fff' }}
        >
          {nodeDatum.name}
        </text>
        {/* Line 2: Short address or package tier */}
        <text
          fill="#fff"
          fontSize="13"
          fontWeight="600"
          textAnchor="middle"
          y="15"
          stroke="#000"
          strokeWidth="2"
          paintOrder="stroke fill"
          style={{ filter: 'drop-shadow(0 1px 1px #000)', textShadow: '0 1px 4px #000, 0 0 3px #fff' }}
        >
          {nodeDatum.attributes?.address ? `${nodeDatum.attributes.address.slice(0, 8)}...` : (nodeDatum.attributes?.packageTier ? `$${[30,50,100,200][nodeDatum.attributes.packageTier-1]}` : '')}
        </text>
      </g>
    );
  };

  return (
    <div className="genealogy-section" role="region" aria-label="Network Genealogy Tree Visualization" aria-live="polite">
      {/* Floating Stats Button */}
      <button
        className="tree-stats-fab"
        aria-label="Show Tree Stats"
        title="Show Tree Stats"
        onClick={() => setShowTreeStats(true)}
        tabIndex={0}
        style={{ right: 'auto', left: '20px', top: '18px' }}
      >
        <span role="img" aria-label="Stats">📊</span>
      </button>
      
      {/* Stats Popover */}
      {showTreeStats && (
        <div className="tree-stats-popover" role="dialog" aria-modal="true" tabIndex={-1}>
          <div className="tree-stats-popover-content">
            <button className="tree-stats-popover-close" onClick={() => setShowTreeStats(false)} aria-label="Close Stats">✖</button>
            <h4 style={{ color: '#00D4FF', textAlign: 'center', margin: '0 0 16px', fontSize: '1.2rem', fontWeight: '600' }}>Network Statistics</h4>
            <div className="tree-stats-grid">
              <div className="tree-stats-card">
                <div className="tree-stats-value">{treeStats.totalUsers}</div>
                <div className="tree-stats-label">Total Users</div>
              </div>
              <div className="tree-stats-card">
                <div className="tree-stats-value">${parseFloat(treeStats.totalVolume).toLocaleString(undefined, {maximumFractionDigits: 1})}K</div>
                <div className="tree-stats-label">Total Volume</div>
              </div>
              <div className="tree-stats-card">
                <div className="tree-stats-value">{treeStats.maxDepth}</div>
                <div className="tree-stats-label">Max Depth</div>
              </div>
              <div className="tree-stats-card">
                <div className="tree-stats-value">{treeStats.directChildren}</div>
                <div className="tree-stats-label">Direct Children</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Network Statistics Display */}
      <div className="network-stats-display">
        <div className="stats-card">
          <div className="stats-value">{treeStats.totalUsers}</div>
          <div className="stats-label">TOTAL USERS</div>
        </div>
        <div className="stats-card">
          <div className="stats-value">${(treeStats.totalVolume / 1000).toFixed(1)}K</div>
          <div className="stats-label">TOTAL VOLUME</div>
        </div>
        <div className="stats-card">
          <div className="stats-value">{treeStats.maxDepth}</div>
          <div className="stats-label">MAX DEPTH</div>
        </div>
        <div className="stats-card">
          <div className="stats-value">{treeStats.directChildren}</div>
          <div className="stats-label">DIRECT CHILDREN</div>
        </div>
      </div>

      <div className="genealogy-header">
        <h3>Network Genealogy Tree</h3>
        <div className="genealogy-controls">
          <button 
            className="tree-control-btn"
            onClick={() => setTreeExpanded(!treeExpanded)}
            aria-label={treeExpanded ? "Collapse network tree" : "Expand network tree"}
            aria-expanded={treeExpanded}
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setTreeExpanded(!treeExpanded); }}
          >
            {treeExpanded ? 'Collapse' : 'Expand'} Tree
          </button>
          <input 
            className="tree-search-input"
            type="text"
            placeholder="Search user ID or address"
            value={treeSearch}
            onChange={e => handleValidatedTreeSearch(e.target.value)}
            aria-label="Search user in tree"
          />
          {searchError && <div className="input-error-message">{searchError}</div>}
          <select 
            value={selectedTreeUser}
            onChange={e => handleUserSelect(e.target.value)}
            className="tree-user-selector"
            aria-label="Select user to focus on in tree"
          >
            <option value="">Select User to Focus</option>
            {realtimeData.registrations.slice(0, 10).map(reg => (
              <option key={reg.user} value={reg.user}>
                User #{reg.userId} ({reg.user.slice(0, 8)}...)
              </option>
            ))}
          </select>
          {selectorError && <div className="input-error-message">{selectorError}</div>}
          <button 
            className="tree-minimap-toggle"
            onClick={() => setTreeMinimapVisible(v => !v)}
            aria-label="Toggle tree minimap"
          >
            {treeMinimapVisible ? 'Hide Minimap' : 'Show Minimap'}
          </button>
        </div>
      </div>
      
      <div className="genealogy-container" style={{ height: '500px', width: '100%' }}>
        {loading ? (
          <div className="tree-skeleton shimmer" aria-hidden="true">
            <div className="tree-loading-indicator">
              <span className="spinner" role="status" aria-live="polite">⏳ Loading tree...</span>
            </div>
          </div>
        ) : (
          <>
            <Tree
              ref={treeRef}
              data={networkTreeData}
              orientation={orientation} // vertical or horizontal
              pathFunc="diagonal"
              nodeSize={orientation === 'vertical' ? { x: 200, y: 100 } : { x: 100, y: 200 }}
              separation={{ siblings: 1.5, nonSiblings: 2 }}
              translate={orientation === 'vertical' ? { x: 400, y: 50 } : { x: 100, y: 250 }}
              zoom={0.8}
              scaleExtent={{ min: 0.1, max: 3 }}
              enableLegacyTransitions={true}
              renderCustomNodeElement={renderCustomNode}
            />
            {treeMinimapVisible && (
              <div className="tree-minimap" aria-label="Genealogy Tree Minimap">
                <Tree
                  ref={minimapRef}
                  data={networkTreeData}
                  orientation={orientation}
                  pathFunc="diagonal"
                  nodeSize={orientation === 'vertical' ? { x: 40, y: 20 } : { x: 20, y: 40 }}
                  separation={{ siblings: 1.2, nonSiblings: 1.5 }}
                  translate={orientation === 'vertical' ? { x: 100, y: 20 } : { x: 20, y: 100 }}
                  zoom={0.2}
                  scaleExtent={{ min: 0.1, max: 0.5 }}
                  enableLegacyTransitions={false}
                  renderCustomNodeElement={(rd3tProps) => (
                    <g onClick={() => handleMinimapNodeClick(rd3tProps.nodeDatum)} tabIndex={0} aria-label={`Minimap node: ${rd3tProps.nodeDatum.name}`}>
                      <circle r={5} fill={getPackageTierColor(rd3tProps.nodeDatum.attributes?.packageTier)} />
                    </g>
                  )}
                />
              </div>
            )}
          </>
        )}
      </div>
      
      <div className="tree-legend">
        <h4>Package Tiers</h4>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#FF6B35' }}></div>
            <span>$30 Package</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#00D4FF' }}></div>
            <span>$50 Package</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#7B2CBF' }}></div>
            <span>$100 Package</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#00FF88' }}></div>
            <span>$200 Package</span>
          </div>
        </div>
      </div>
      
      {/* Package Tier Statistics */}
      <div className="package-tier-stats">
        <h4>Package Distribution</h4>
        <div className="tier-stats-grid">
          <div className="tier-stat">
            <div className="tier-color" style={{ backgroundColor: '#FF6B35' }}></div>
            <div className="tier-info">
              <span className="tier-count">{realtimeData.registrations.filter(r => r.packageTier === 1).length}</span>
              <span className="tier-label">$30 Packages</span>
            </div>
          </div>
          <div className="tier-stat">
            <div className="tier-color" style={{ backgroundColor: '#00D4FF' }}></div>
            <div className="tier-info">
              <span className="tier-count">{realtimeData.registrations.filter(r => r.packageTier === 2).length}</span>
              <span className="tier-label">$50 Packages</span>
            </div>
          </div>
          <div className="tier-stat">
            <div className="tier-color" style={{ backgroundColor: '#7B2CBF' }}></div>
            <div className="tier-info">
              <span className="tier-count">{realtimeData.registrations.filter(r => r.packageTier === 3).length}</span>
              <span className="tier-label">$100 Packages</span>
            </div>
          </div>
          <div className="tier-stat">
            <div className="tier-color" style={{ backgroundColor: '#00FF88' }}></div>
            <div className="tier-info">
              <span className="tier-count">{realtimeData.registrations.filter(r => r.packageTier === 4).length}</span>
              <span className="tier-label">$200 Packages</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenealogyTreeBundle;
