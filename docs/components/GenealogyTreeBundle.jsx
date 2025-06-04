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
  treeStats
}) => {
  const treeRef = useRef();
  const minimapRef = useRef();

  useEffect(() => {
    // If search results, auto-focus/zoom to the first found node
    if (treeSearchResults.length && treeRef.current) {
      // Use react-d3-tree API to center/zoom to node (pseudo-code, actual API may differ)
      // treeRef.current.centerNode(treeSearchResults[0]);
      // For now, just alert user
      addAlert(`Found user: ${treeSearchResults[0].user}`, 'info');
    }
  }, [treeSearchResults, addAlert]);

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
            onChange={e => handleTreeSearch(e.target.value)}
            aria-label="Search user in tree"
          />
          <select 
            value={selectedTreeUser}
            onChange={(e) => {
              setSelectedTreeUser(e.target.value);
              focusOnTreeUser(e.target.value);
            }}
            className="tree-user-selector"
            aria-label="Select user to focus on in tree"
            tabIndex={0}
          >
            <option value="">Select User to Focus</option>
            {realtimeData.registrations.slice(0, 10).map(reg => (
              <option key={reg.user} value={reg.user}>
                User #{reg.userId} ({reg.user.slice(0, 8)}...)
              </option>
            ))}
          </select>
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
          <div className="tree-skeleton shimmer" aria-hidden="true"></div>
        ) : (
          <>
            <Tree
              ref={treeRef}
              data={networkTreeData}
              orientation="vertical"
              pathFunc="diagonal"
              nodeSize={{ x: 200, y: 100 }}
              separation={{ siblings: 1.5, nonSiblings: 2 }}
              translate={{ x: 400, y: 50 }}
              zoom={0.8}
              scaleExtent={{ min: 0.1, max: 3 }}
              enableLegacyTransitions={true}
              renderCustomNodeElement={(rd3tProps) => (
                <g data-tooltip={`Address: ${rd3tProps.nodeDatum.attributes?.address} | Tier: ${rd3tProps.nodeDatum.attributes?.packageTier}`}
                  className={treeSearchResults.some(r => r.user === rd3tProps.nodeDatum.attributes?.address) ? 'tree-node-highlight' : ''}
                >
                  <circle
                    r={20}
                    fill={rd3tProps.nodeDatum.attributes?.packageTier ? ['#FF6B35', '#00D4FF', '#7B2CBF', '#00FF88'][rd3tProps.nodeDatum.attributes.packageTier - 1] : '#666'}
                    stroke="#fff"
                    strokeWidth={3}
                    style={{
                      filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.4))'
                    }}
                    className="tree-node-animated"
                    tabIndex={0}
                    aria-label={`User node: ${rd3tProps.nodeDatum.name}`}
                  />
                  <text
                    fill="#fff"
                    fontSize="18"
                    fontWeight="bold"
                    textAnchor="middle"
                    y="7" 
                    dominantBaseline="middle"
                    alignmentBaseline="middle"
                    stroke="#000"
                    strokeWidth="4"
                    paintOrder="stroke fill"
                    style={{
                      filter: 'drop-shadow(0 2px 2px #000)',
                      textShadow: '0 2px 8px #000, 0 0 4px #fff',
                      letterSpacing: '1px',
                      wordSpacing: '2px',
                    }}
                  >
                    {rd3tProps.nodeDatum.name}
                  </text>
                  <text
                    fill="#fff"
                    fontSize="14"
                    fontWeight="600"
                    textAnchor="middle"
                    y="-24" 
                    dominantBaseline="middle"
                    alignmentBaseline="middle"
                    stroke="#000"
                    strokeWidth="3"
                    paintOrder="stroke fill"
                    style={{
                      filter: 'drop-shadow(0 1px 1px #000)',
                      textShadow: '0 1px 4px #000, 0 0 3px #fff',
                      letterSpacing: '1px',
                      wordSpacing: '2px',
                    }}
                  >
                    {rd3tProps.nodeDatum.attributes?.address?.slice(0, 6)}...
                  </text>
                </g>
              )}
            />
            {treeMinimapVisible && (
              <div className="tree-minimap" aria-label="Genealogy Tree Minimap">
                <Tree
                  ref={minimapRef}
                  data={networkTreeData}
                  orientation="vertical"
                  pathFunc="diagonal"
                  nodeSize={{ x: 40, y: 20 }}
                  separation={{ siblings: 1.2, nonSiblings: 1.5 }}
                  translate={{ x: 100, y: 20 }}
                  zoom={0.2}
                  scaleExtent={{ min: 0.1, max: 0.5 }}
                  enableLegacyTransitions={false}
                  renderCustomNodeElement={(rd3tProps) => (
                    <g onClick={() => handleMinimapNodeClick(rd3tProps.nodeDatum)} tabIndex={0} aria-label={`Minimap node: ${rd3tProps.nodeDatum.name}`}>
                      <circle r={5} fill={rd3tProps.nodeDatum.attributes?.packageTier ? ['#FF6B35', '#00D4FF', '#7B2CBF', '#00FF88'][rd3tProps.nodeDatum.attributes.packageTier - 1] : '#666'} />
                    </g>
                  )}
                />
              </div>
            )}
          </>
        )}
      </div>
      
      <div className="tree-legend">
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
  );
};

export default GenealogyTreeBundle;
