import React, { useState } from 'react';
import './OrphiChain.css';

const GenealogyTreeDemo = ({ demoMode = false }) => {
  const [nodeSelected, setNodeSelected] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  
  // Mock genealogy data
  const rootNode = {
    id: 'root-1',
    name: 'Sarah Johnson',
    address: '0x742E...9F12',
    level: 'Diamond',
    teamSize: 245,
    earnings: 45680,
    children: [
      {
        id: 'node-1-1',
        name: 'Michael Chen',
        address: '0x891A...3F42',
        level: 'Platinum',
        teamSize: 120,
        earnings: 28450,
        isActive: true
      },
      {
        id: 'node-1-2',
        name: 'Jessica Lee',
        address: '0x567B...1E23',
        level: 'Gold',
        teamSize: 85,
        earnings: 15680,
        isActive: true
      },
      {
        id: 'node-1-3',
        name: 'Robert Smith',
        address: '0x321F...8D45',
        level: 'Silver',
        teamSize: 40,
        earnings: 8540,
        isActive: false
      }
    ]
  };
  
  const handleNodeClick = (nodeId) => {
    if (nodeSelected === nodeId) {
      setNodeSelected(null);
    } else {
      setNodeSelected(nodeId);
    }
  };
  
  return (
    <div className="genealogy-tree-demo">
      <div className="genealogy-header">
        <h2>OrphiChain Genealogy Tree</h2>
        <div className="genealogy-controls">
          <div className="zoom-controls">
            <button 
              onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}
              className="zoom-btn"
              title="Zoom Out"
            >
              -
            </button>
            <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
            <button 
              onClick={() => setZoomLevel(prev => Math.min(2, prev + 0.1))}
              className="zoom-btn"
              title="Zoom In"
            >
              +
            </button>
          </div>
          <div className="view-controls">
            <label className="labels-toggle">
              <input 
                type="checkbox" 
                checked={showLabels}
                onChange={() => setShowLabels(prev => !prev)}
              />
              Show Labels
            </label>
          </div>
        </div>
      </div>
      
      <div className="genealogy-container" style={{ transform: `scale(${zoomLevel})` }}>
        <div className="tree-visualization">
          <div className="node-level">
            <div 
              className={`tree-node root ${nodeSelected === rootNode.id ? 'selected' : ''}`}
              onClick={() => handleNodeClick(rootNode.id)}
            >
              <div className="node-icon diamond"></div>
              {showLabels && (
                <div className="node-label">
                  <div className="node-name">{rootNode.name}</div>
                  <div className="node-address">{rootNode.address}</div>
                </div>
              )}
            </div>
          </div>
          
          <div className="connector-container">
            <div className="connector-line vertical"></div>
            <div className="connector-line horizontal"></div>
          </div>
          
          <div className="node-level">
            {rootNode.children.map((child, index) => (
              <div 
                key={child.id}
                className={`tree-node ${child.isActive ? 'active' : 'inactive'} ${nodeSelected === child.id ? 'selected' : ''}`}
                onClick={() => handleNodeClick(child.id)}
              >
                <div className={`node-icon ${child.level.toLowerCase()}`}></div>
                {showLabels && (
                  <div className="node-label">
                    <div className="node-name">{child.name}</div>
                    <div className="node-address">{child.address}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="node-details-panel">
        <h3>Node Details</h3>
        {nodeSelected ? (
          <div className="details-content">
            {nodeSelected === rootNode.id ? (
              <>
                <div className="detail-item">
                  <span className="detail-label">Name:</span>
                  <span className="detail-value">{rootNode.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Address:</span>
                  <span className="detail-value">{rootNode.address}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Level:</span>
                  <span className="detail-value level-badge diamond">{rootNode.level}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Team Size:</span>
                  <span className="detail-value">{rootNode.teamSize} members</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Earnings:</span>
                  <span className="detail-value">${rootNode.earnings.toLocaleString()}</span>
                </div>
              </>
            ) : (
              rootNode.children.map(child => {
                if (child.id === nodeSelected) {
                  return (
                    <React.Fragment key={child.id}>
                      <div className="detail-item">
                        <span className="detail-label">Name:</span>
                        <span className="detail-value">{child.name}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Address:</span>
                        <span className="detail-value">{child.address}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Level:</span>
                        <span className={`detail-value level-badge ${child.level.toLowerCase()}`}>{child.level}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Team Size:</span>
                        <span className="detail-value">{child.teamSize} members</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Earnings:</span>
                        <span className="detail-value">${child.earnings.toLocaleString()}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Status:</span>
                        <span className={`detail-value status-badge ${child.isActive ? 'active' : 'inactive'}`}>
                          {child.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                }
                return null;
              })
            )}
          </div>
        ) : (
          <div className="no-selection">
            <p>Click on a node in the tree to view details</p>
          </div>
        )}
      </div>
      
      {demoMode && (
        <div className="demo-notice">
          <p>Demo Mode: This is a simplified visualization with sample data</p>
        </div>
      )}
      
      <style jsx>{`
        .genealogy-tree-demo {
          background-color: #f8f9fa;
          padding: 1.5rem;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #333;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        .genealogy-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        
        .genealogy-header h2 {
          color: var(--orphi-royal-purple);
          margin: 0;
        }
        
        .genealogy-controls {
          display: flex;
          gap: 1.5rem;
        }
        
        .zoom-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .zoom-btn {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1.2rem;
          cursor: pointer;
        }
        
        .zoom-btn:hover {
          background-color: #f0f0f0;
        }
        
        .zoom-level {
          font-size: 0.9rem;
          min-width: 50px;
          text-align: center;
        }
        
        .labels-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }
        
        .genealogy-container {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          transform-origin: center center;
          transition: transform 0.3s ease;
          overflow: auto;
          margin: 1rem 0;
          padding: 2rem;
        }
        
        .tree-visualization {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .node-level {
          display: flex;
          gap: 4rem;
          justify-content: center;
        }
        
        .tree-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 8px;
          transition: all 0.2s ease;
          position: relative;
        }
        
        .tree-node:hover {
          background-color: rgba(123, 44, 191, 0.1);
          transform: translateY(-3px);
        }
        
        .tree-node.selected {
          background-color: rgba(123, 44, 191, 0.15);
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
        }
        
        .node-icon {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.5rem;
          border: 2px solid transparent;
        }
        
        .node-icon.diamond {
          background: linear-gradient(135deg, #7B2CBF, #00D4FF);
          border-color: #7B2CBF;
        }
        
        .node-icon.platinum {
          background: linear-gradient(135deg, #7d7d7d, #e5e5e5);
          border-color: #7d7d7d;
        }
        
        .node-icon.gold {
          background: linear-gradient(135deg, #ffd700, #ffcc00);
          border-color: #ffd700;
        }
        
        .node-icon.silver {
          background: linear-gradient(135deg, #c0c0c0, #e0e0e0);
          border-color: #c0c0c0;
        }
        
        .tree-node.inactive .node-icon {
          opacity: 0.6;
        }
        
        .node-label {
          text-align: center;
          min-width: 150px;
        }
        
        .node-name {
          font-weight: 500;
          margin-bottom: 0.2rem;
        }
        
        .node-address {
          font-size: 0.8rem;
          color: #666;
        }
        
        .connector-container {
          position: relative;
          height: 50px;
          width: 100%;
        }
        
        .connector-line {
          background-color: #ddd;
          position: absolute;
        }
        
        .connector-line.vertical {
          width: 2px;
          height: 30px;
          left: 50%;
          transform: translateX(-50%);
        }
        
        .connector-line.horizontal {
          height: 2px;
          width: calc(100% - 100px);
          top: 30px;
          left: 50px;
        }
        
        .node-details-panel {
          background-color: white;
          border-radius: 8px;
          padding: 1.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          margin-top: 1rem;
        }
        
        .node-details-panel h3 {
          margin: 0 0 1rem 0;
          color: var(--orphi-royal-purple);
          border-bottom: 1px solid #eee;
          padding-bottom: 0.5rem;
        }
        
        .details-content {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }
        
        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        
        .detail-label {
          font-size: 0.8rem;
          color: #666;
        }
        
        .detail-value {
          font-size: 1rem;
          font-weight: 500;
        }
        
        .level-badge {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          color: white;
          font-size: 0.9rem;
        }
        
        .level-badge.diamond {
          background-color: var(--orphi-royal-purple);
        }
        
        .level-badge.platinum {
          background-color: #7d7d7d;
        }
        
        .level-badge.gold {
          background-color: #ffd700;
          color: #333;
        }
        
        .level-badge.silver {
          background-color: #c0c0c0;
          color: #333;
        }
        
        .status-badge {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        
        .status-badge.active {
          background-color: var(--orphi-success-green);
          color: white;
        }
        
        .status-badge.inactive {
          background-color: #f0f0f0;
          color: #999;
        }
        
        .no-selection {
          text-align: center;
          color: #999;
          padding: 1rem;
        }
        
        .demo-notice {
          margin-top: 1.5rem;
          text-align: center;
          color: var(--orphi-energy-orange);
          font-style: italic;
        }
        
        @media (max-width: 992px) {
          .details-content {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .genealogy-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }
          
          .genealogy-controls {
            width: 100%;
          }
        }
        
        @media (max-width: 576px) {
          .node-level {
            gap: 2rem;
          }
          
          .details-content {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default GenealogyTreeDemo;
