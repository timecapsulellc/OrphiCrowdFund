import React, { useState } from 'react';
import './OrphiChain.css';

const NetworkVisualization = ({ demoMode = false }) => {
  const [viewMode, setViewMode] = useState('network');
  const [filterActive, setFilterActive] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  return (
    <div className="network-visualization">
      <div className="visualization-header">
        <div className="title-section">
          <h2>OrphiChain Network Visualization</h2>
          {demoMode && <span className="demo-tag">Demo Mode</span>}
        </div>
        <div className="controls-section">
          <div className="view-toggle">
            <button 
              className={`view-button ${viewMode === 'network' ? 'active' : ''}`}
              onClick={() => setViewMode('network')}
            >
              Network View
            </button>
            <button 
              className={`view-button ${viewMode === 'heatmap' ? 'active' : ''}`}
              onClick={() => setViewMode('heatmap')}
            >
              Activity Heatmap
            </button>
          </div>
          <div className="search-filter">
            <input 
              type="text" 
              placeholder="Search nodes..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <label className="filter-toggle">
              <input 
                type="checkbox" 
                checked={filterActive}
                onChange={() => setFilterActive(prev => !prev)}
              />
              Active Nodes Only
            </label>
          </div>
        </div>
      </div>
      
      <div className="visualization-content">
        <div className="network-container">
          {viewMode === 'network' ? (
            <div className="network-graph">
              <div className="visualization-placeholder">
                <div className="network-node central">
                  <span className="node-label">OrphiChain</span>
                </div>
                <div className="network-connections">
                  {/* First level nodes */}
                  <div className="network-level">
                    {[...Array(5)].map((_, i) => (
                      <div key={`level1-${i}`} className="network-node level-1">
                        <span className="node-label">Node {i+1}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Second level nodes */}
                  <div className="network-level level-2-container">
                    {[...Array(8)].map((_, i) => (
                      <div key={`level2-${i}`} className="network-node level-2">
                        <span className="node-label">Sub {i+1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="graph-legend">
                <div className="legend-item">
                  <div className="legend-color central"></div>
                  <span>Central Node</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color level-1"></div>
                  <span>Primary Connections</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color level-2"></div>
                  <span>Secondary Connections</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="heatmap-view">
              <div className="heatmap-placeholder">
                <div className="heatmap-grid">
                  {[...Array(7)].map((_, row) => (
                    <div key={`row-${row}`} className="heatmap-row">
                      {[...Array(10)].map((_, col) => {
                        // Generate a random value for demo purposes
                        const value = Math.random();
                        let intensity;
                        if (value < 0.2) intensity = 'very-low';
                        else if (value < 0.4) intensity = 'low';
                        else if (value < 0.6) intensity = 'medium';
                        else if (value < 0.8) intensity = 'high';
                        else intensity = 'very-high';
                        
                        return (
                          <div 
                            key={`cell-${row}-${col}`} 
                            className={`heatmap-cell ${intensity}`}
                            title={`Region ${row+1}-${col+1}: ${Math.round(value * 100)}% activity`}
                          ></div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="heatmap-legend">
                <div className="legend-title">Activity Intensity</div>
                <div className="intensity-scale">
                  <div className="intensity-marker very-low"></div>
                  <div className="intensity-marker low"></div>
                  <div className="intensity-marker medium"></div>
                  <div className="intensity-marker high"></div>
                  <div className="intensity-marker very-high"></div>
                </div>
                <div className="intensity-labels">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="network-stats">
          <div className="stats-card">
            <h3>Network Overview</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Total Nodes</span>
                <span className="stat-value">3,452</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Active Nodes</span>
                <span className="stat-value">2,871</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Connections</span>
                <span className="stat-value">8,975</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Network Density</span>
                <span className="stat-value">0.78</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Average Degree</span>
                <span className="stat-value">5.2</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Clustering Coefficient</span>
                <span className="stat-value">0.65</span>
              </div>
            </div>
          </div>
          
          <div className="node-activity-card">
            <h3>Recent Activity</h3>
            <div className="activity-list">
              <div className="activity-item">
                <div className="activity-indicator new-node"></div>
                <div className="activity-details">
                  <span className="activity-title">New Node Joined</span>
                  <span className="activity-info">Node 0x67F3...2A41 connected</span>
                  <span className="activity-time">2 minutes ago</span>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-indicator connection"></div>
                <div className="activity-details">
                  <span className="activity-title">New Connection</span>
                  <span className="activity-info">0x42B1...9F12 → 0x89F7...1A32</span>
                  <span className="activity-time">15 minutes ago</span>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-indicator disconnection"></div>
                <div className="activity-details">
                  <span className="activity-title">Node Disconnected</span>
                  <span className="activity-info">Node 0x12D8...8B34 inactive</span>
                  <span className="activity-time">28 minutes ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="network-footer">
        <p>Data refreshes every 60 seconds • Last updated: just now</p>
      </div>
      
      <style jsx>{`
        .network-visualization {
          background-color: #f8f9fa;
          padding: 1.5rem;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #333;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        .visualization-header {
          margin-bottom: 1.5rem;
        }
        
        .title-section {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .title-section h2 {
          margin: 0;
          color: var(--orphi-royal-purple);
        }
        
        .demo-tag {
          background-color: var(--orphi-energy-orange);
          color: white;
          font-size: 0.7rem;
          padding: 0.2rem 0.5rem;
          border-radius: 20px;
          font-weight: 600;
        }
        
        .controls-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: white;
          border-radius: 8px;
          padding: 0.8rem 1.2rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        
        .view-toggle {
          display: flex;
          gap: 0.5rem;
        }
        
        .view-button {
          background: none;
          border: 1px solid #ddd;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s ease;
        }
        
        .view-button.active {
          background-color: var(--orphi-royal-purple);
          color: white;
          border-color: var(--orphi-royal-purple);
        }
        
        .search-filter {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .search-input {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          border-radius: 20px;
          font-size: 0.9rem;
          width: 200px;
        }
        
        .filter-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.9rem;
        }
        
        .visualization-content {
          flex: 1;
          display: grid;
          grid-template-columns: 3fr 1fr;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }
        
        .network-container {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          position: relative;
        }
        
        .network-graph, .heatmap-view {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        .visualization-placeholder {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          padding: 2rem;
        }
        
        .network-node {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 2;
        }
        
        .network-node.central {
          width: 70px;
          height: 70px;
          background: linear-gradient(135deg, var(--orphi-royal-purple), var(--orphi-cyber-blue));
          box-shadow: 0 0 15px rgba(123, 44, 191, 0.5);
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        
        .network-connections {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1;
        }
        
        .network-level {
          position: absolute;
        }
        
        .network-node.level-1 {
          background-color: var(--orphi-cyber-blue);
          box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
          position: absolute;
        }
        
        .network-node.level-1:nth-child(1) {
          top: 25%;
          left: 30%;
        }
        
        .network-node.level-1:nth-child(2) {
          top: 15%;
          right: 35%;
        }
        
        .network-node.level-1:nth-child(3) {
          bottom: 20%;
          left: 25%;
        }
        
        .network-node.level-1:nth-child(4) {
          top: 70%;
          right: 30%;
        }
        
        .network-node.level-1:nth-child(5) {
          top: 50%;
          left: 20%;
        }
        
        .level-2-container {
          width: 100%;
          height: 100%;
        }
        
        .network-node.level-2 {
          background-color: var(--orphi-energy-orange);
          width: 30px;
          height: 30px;
          position: absolute;
        }
        
        .network-node.level-2:nth-child(1) { top: 15%; left: 15%; }
        .network-node.level-2:nth-child(2) { top: 25%; left: 45%; }
        .network-node.level-2:nth-child(3) { top: 10%; right: 20%; }
        .network-node.level-2:nth-child(4) { top: 35%; right: 15%; }
        .network-node.level-2:nth-child(5) { bottom: 20%; right: 15%; }
        .network-node.level-2:nth-child(6) { bottom: 30%; left: 40%; }
        .network-node.level-2:nth-child(7) { bottom: 15%; left: 15%; }
        .network-node.level-2:nth-child(8) { top: 60%; left: 10%; }
        
        .node-label {
          position: absolute;
          bottom: -20px;
          white-space: nowrap;
          font-size: 0.7rem;
          color: #666;
        }
        
        .graph-legend {
          display: flex;
          justify-content: center;
          gap: 2rem;
          padding: 1rem;
          border-top: 1px solid #eee;
        }
        
        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
        }
        
        .legend-color {
          width: 15px;
          height: 15px;
          border-radius: 50%;
        }
        
        .legend-color.central {
          background: linear-gradient(135deg, var(--orphi-royal-purple), var(--orphi-cyber-blue));
        }
        
        .legend-color.level-1 {
          background-color: var(--orphi-cyber-blue);
        }
        
        .legend-color.level-2 {
          background-color: var(--orphi-energy-orange);
        }
        
        .heatmap-placeholder {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 2rem;
        }
        
        .heatmap-grid {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        
        .heatmap-row {
          display: flex;
          gap: 3px;
        }
        
        .heatmap-cell {
          width: 35px;
          height: 35px;
          border-radius: 3px;
        }
        
        .heatmap-cell.very-low { background-color: rgba(0, 212, 255, 0.1); }
        .heatmap-cell.low { background-color: rgba(0, 212, 255, 0.3); }
        .heatmap-cell.medium { background-color: rgba(0, 212, 255, 0.5); }
        .heatmap-cell.high { background-color: rgba(0, 212, 255, 0.7); }
        .heatmap-cell.very-high { background-color: rgba(0, 212, 255, 0.9); }
        
        .heatmap-legend {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem;
          border-top: 1px solid #eee;
        }
        
        .legend-title {
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
        }
        
        .intensity-scale {
          display: flex;
          gap: 2px;
          margin-bottom: 0.3rem;
        }
        
        .intensity-marker {
          width: 30px;
          height: 15px;
        }
        
        .intensity-marker.very-low { background-color: rgba(0, 212, 255, 0.1); }
        .intensity-marker.low { background-color: rgba(0, 212, 255, 0.3); }
        .intensity-marker.medium { background-color: rgba(0, 212, 255, 0.5); }
        .intensity-marker.high { background-color: rgba(0, 212, 255, 0.7); }
        .intensity-marker.very-high { background-color: rgba(0, 212, 255, 0.9); }
        
        .intensity-labels {
          display: flex;
          justify-content: space-between;
          width: 100%;
          font-size: 0.8rem;
          color: #666;
        }
        
        .network-stats {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        
        .stats-card, .node-activity-card {
          background-color: white;
          border-radius: 8px;
          padding: 1.2rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        
        .stats-card h3, .node-activity-card h3 {
          margin: 0 0 1rem 0;
          color: var(--orphi-royal-purple);
          font-size: 1rem;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        
        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        
        .stat-label {
          font-size: 0.8rem;
          color: #666;
        }
        
        .stat-value {
          font-size: 1.1rem;
          font-weight: 600;
        }
        
        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }
        
        .activity-item {
          display: flex;
          gap: 0.8rem;
          padding-bottom: 0.8rem;
          border-bottom: 1px solid #eee;
        }
        
        .activity-item:last-child {
          padding-bottom: 0;
          border-bottom: none;
        }
        
        .activity-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-top: 0.3rem;
        }
        
        .activity-indicator.new-node {
          background-color: var(--orphi-success-green);
        }
        
        .activity-indicator.connection {
          background-color: var(--orphi-cyber-blue);
        }
        
        .activity-indicator.disconnection {
          background-color: var(--orphi-energy-orange);
        }
        
        .activity-details {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        
        .activity-title {
          font-weight: 500;
          font-size: 0.9rem;
        }
        
        .activity-info {
          font-size: 0.8rem;
          color: #666;
        }
        
        .activity-time {
          font-size: 0.7rem;
          color: #999;
        }
        
        .network-footer {
          text-align: center;
          color: #666;
          font-size: 0.9rem;
        }
        
        @media (max-width: 992px) {
          .visualization-content {
            grid-template-columns: 1fr;
          }
          
          .network-stats {
            flex-direction: row;
          }
          
          .stats-card, .node-activity-card {
            flex: 1;
          }
        }
        
        @media (max-width: 768px) {
          .controls-section {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }
          
          .search-filter {
            width: 100%;
            justify-content: space-between;
          }
          
          .network-stats {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default NetworkVisualization;
