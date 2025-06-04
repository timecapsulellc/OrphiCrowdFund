import React, { useState, useEffect } from 'react';
import Tree from 'react-d3-tree';
import OrphiChainLogo from './OrphiChainLogo';
import ExportPanel from './ExportPanel';
import './OrphiChain.css';
import './GenealogyTreeDemo.css';

/**
 * OrphiChain Genealogy Tree Demo Component
 * 
 * Features:
 * - Interactive D3 tree visualization using react-d3-tree
 * - OrphiChain brand-compliant styling
 * - Real-time network relationship mapping
 * - Export functionality for network reports
 * - Mobile-responsive design
 * - Custom node rendering with package tier colors
 */

const GenealogyTreeDemo = () => {
  const [treeData, setTreeData] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [treeOrientation, setTreeOrientation] = useState('vertical');
  const [zoomLevel, setZoomLevel] = useState(0.8);

  // Sample network data (in production, this would come from contract)
  const sampleNetworkData = {
    name: 'OrphiChain Network',
    attributes: {
      address: 'Root',
      packageTier: null,
      volume: 0,
      registrationDate: new Date().toISOString()
    },
    children: [
      {
        name: 'User #1',
        attributes: {
          address: '0x1234...5678',
          packageTier: 4,
          volume: 15000,
          registrationDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          downlineCount: 12
        },
        children: [
          {
            name: 'User #2',
            attributes: {
              address: '0x2345...6789',
              packageTier: 3,
              volume: 8500,
              registrationDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
              downlineCount: 5
            },
            children: [
              {
                name: 'User #5',
                attributes: {
                  address: '0x5678...9012',
                  packageTier: 2,
                  volume: 3200,
                  registrationDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
                  downlineCount: 2
                }
              },
              {
                name: 'User #6',
                attributes: {
                  address: '0x6789...0123',
                  packageTier: 1,
                  volume: 1500,
                  registrationDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
                  downlineCount: 0
                }
              }
            ]
          },
          {
            name: 'User #3',
            attributes: {
              address: '0x3456...7890',
              packageTier: 2,
              volume: 4200,
              registrationDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
              downlineCount: 3
            },
            children: [
              {
                name: 'User #7',
                attributes: {
                  address: '0x7890...1234',
                  packageTier: 1,
                  volume: 1200,
                  registrationDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                  downlineCount: 1
                }
              }
            ]
          }
        ]
      },
      {
        name: 'User #4',
        attributes: {
          address: '0x4567...8901',
          packageTier: 3,
          volume: 12000,
          registrationDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
          downlineCount: 8
        },
        children: [
          {
            name: 'User #8',
            attributes: {
              address: '0x8901...2345',
              packageTier: 2,
              volume: 5500,
              registrationDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
              downlineCount: 4
            }
          },
          {
            name: 'User #9',
            attributes: {
              address: '0x9012...3456',
              packageTier: 4,
              volume: 18000,
              registrationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
              downlineCount: 7
            }
          }
        ]
      }
    ]
  };

  useEffect(() => {
    setTreeData(sampleNetworkData);
  }, []);

  // Get package tier color
  const getPackageTierColor = (tier) => {
    const colors = {
      1: '#FF6B35', // $30 Package - Energy Orange
      2: '#00D4FF', // $50 Package - Cyber Blue
      3: '#7B2CBF', // $100 Package - Royal Purple
      4: '#00FF88'  // $200 Package - Success Green
    };
    return colors[tier] || '#666666';
  };

  // Get package tier label
  const getPackageTierLabel = (tier) => {
    const labels = {
      1: '$30',
      2: '$50', 
      3: '$100',
      4: '$200'
    };
    return labels[tier] || 'Unknown';
  };

  // Custom node render function
  const renderCustomNode = (rd3tProps) => {
    const { nodeDatum } = rd3tProps;
    const isRoot = nodeDatum.name === 'OrphiChain Network';
    const radius = isRoot ? 30 : 25;
    const color = isRoot ? '#00D4FF' : getPackageTierColor(nodeDatum.attributes?.packageTier);

    return (
      <g onClick={() => setSelectedNode(nodeDatum)}>
        {/* Node Circle */}
        <circle
          r={radius}
          fill={color}
          stroke="#ffffff"
          strokeWidth={3}
          style={{
            cursor: 'pointer',
            filter: selectedNode?.name === nodeDatum.name ? 
              'brightness(1.3) drop-shadow(0 0 8px rgba(255,255,255,0.4))' : 
              'brightness(1) drop-shadow(0 0 8px rgba(255,255,255,0.4))'
          }}
        />
        
        {/* Center Icon */}
        <text
          fill="#ffffff"
          fontSize={isRoot ? "16" : "14"}
          textAnchor="middle"
          y="5"
          fontWeight="bold"
        >
          {isRoot ? '🏢' : '👤'}
        </text>
        
        {/* User Name */}
        <text
          fill="#fff"
          fontSize="18"
          fontWeight="bold"
          textAnchor="middle"
          y={radius + 22}
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
          {nodeDatum.name}
        </text>
        
        {/* Package Tier Label */}
        {!isRoot && (
          <text
            fill="#fff"
            fontSize="14"
            fontWeight="600"
            textAnchor="middle"
            y={radius + 42}
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
            {getPackageTierLabel(nodeDatum.attributes?.packageTier)}
          </text>
        )}
        
        {/* Address */}
        {nodeDatum.attributes?.address && nodeDatum.attributes.address !== 'Root' && (
          <text
            fill="#fff"
            fontSize="14"
            fontWeight="600"
            textAnchor="middle"
            y={-radius - 12}
            dominantBaseline="middle"
            alignmentBaseline="middle"
            stroke="#000"
            strokeWidth="3"
            paintOrder="stroke fill"
            style={{
              filter: 'drop-shadow(0 1px 1px #000)',
              textShadow: '0 1px 4px #000, 0 0 3px #fff',
              letterSpacing: '1px',
              wordSpacing: '1px',
            }}
          >
            {nodeDatum.attributes.address.slice(0, 8)}...
          </text>
        )}
        
        {/* Volume Badge */}
        {!isRoot && nodeDatum.attributes?.volume > 0 && (
          <>
            <rect
              x="-25"
              y={-radius - 5}
              width="50"
              height="12"
              rx="6"
              fill="rgba(0, 212, 255, 0.8)"
            />
            <text
              fill="#ffffff"
              fontSize="8"
              fontWeight="600"
              textAnchor="middle"
              y={-radius + 3}
            >
              ${(nodeDatum.attributes.volume / 1000).toFixed(1)}K
            </text>
          </>
        )}
      </g>
    );
  };

  // Generate export data
  const generateExportData = () => {
    const flattenTree = (node, level = 0) => {
      const result = [{
        name: node.name,
        level,
        address: node.attributes?.address || '',
        packageTier: node.attributes?.packageTier || 0,
        volume: node.attributes?.volume || 0,
        downlineCount: node.attributes?.downlineCount || 0,
        registrationDate: node.attributes?.registrationDate || ''
      }];
      
      if (node.children) {
        node.children.forEach(child => {
          result.push(...flattenTree(child, level + 1));
        });
      }
      
      return result;
    };

    return {
      networkTree: flattenTree(treeData),
      summary: {
        totalUsers: JSON.stringify(treeData).match(/"name":/g)?.length - 1 || 0,
        totalVolume: calculateTotalVolume(treeData),
        maxDepth: calculateMaxDepth(treeData),
        generatedAt: new Date().toISOString()
      }
    };
  };

  // Calculate total volume
  const calculateTotalVolume = (node) => {
    let total = node.attributes?.volume || 0;
    if (node.children) {
      node.children.forEach(child => {
        total += calculateTotalVolume(child);
      });
    }
    return total;
  };

  // Calculate max depth
  const calculateMaxDepth = (node, depth = 0) => {
    if (!node.children || node.children.length === 0) {
      return depth;
    }
    return Math.max(...node.children.map(child => calculateMaxDepth(child, depth + 1)));
  };

  return (
    <div className="genealogy-tree-demo">
      {/* Header */}
      <div className="demo-header">
        <div className="header-content">
          <OrphiChainLogo size="medium" variant="chain" autoRotate={true} />
          <div className="title-section">
            <h1 className="main-title">OrphiChain Genealogy Tree</h1>
            <p className="subtitle">Interactive Network Relationship Visualization</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="tree-controls">
        <div className="control-group">
          <label>Orientation:</label>
          <select 
            value={treeOrientation} 
            onChange={(e) => setTreeOrientation(e.target.value)}
            className="control-select"
          >
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </div>
        <div className="control-group">
          <label>Zoom:</label>
          <input
            type="range"
            min="0.3"
            max="2"
            step="0.1"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="zoom-slider"
          />
          <span className="zoom-value">{(zoomLevel * 100).toFixed(0)}%</span>
        </div>
        <button 
          className="reset-btn"
          onClick={() => {
            setZoomLevel(0.8);
            setSelectedNode(null);
          }}
        >
          Reset View
        </button>
      </div>

      {/* Tree Visualization */}
      <div className="tree-container" style={{ height: '600px', width: '100%' }}>
        {Object.keys(treeData).length > 0 && (
          <Tree
            data={treeData}
            orientation={treeOrientation}
            pathFunc="diagonal"
            nodeSize={{ x: 200, y: 150 }}
            separation={{ siblings: 1.5, nonSiblings: 2 }}
            translate={{ 
              x: treeOrientation === 'vertical' ? 400 : 150, 
              y: treeOrientation === 'vertical' ? 100 : 300 
            }}
            zoom={zoomLevel}
            scaleExtent={{ min: 0.1, max: 3 }}
            enableLegacyTransitions={true}
            renderCustomNodeElement={renderCustomNode}
            collapsible={false}
            depthFactor={treeOrientation === 'vertical' ? 200 : 300}
          />
        )}
      </div>

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="node-info-panel">
          <h3>Node Information</h3>
          <div className="node-details">
            <div className="detail-item">
              <span className="label">Name:</span>
              <span className="value">{selectedNode.name}</span>
            </div>
            {selectedNode.attributes?.address && (
              <div className="detail-item">
                <span className="label">Address:</span>
                <span className="value">{selectedNode.attributes.address}</span>
              </div>
            )}
            {selectedNode.attributes?.packageTier && (
              <div className="detail-item">
                <span className="label">Package:</span>
                <span className="value">{getPackageTierLabel(selectedNode.attributes.packageTier)}</span>
              </div>
            )}
            {selectedNode.attributes?.volume && (
              <div className="detail-item">
                <span className="label">Volume:</span>
                <span className="value">${selectedNode.attributes.volume.toLocaleString()}</span>
              </div>
            )}
            {selectedNode.attributes?.downlineCount !== undefined && (
              <div className="detail-item">
                <span className="label">Downline:</span>
                <span className="value">{selectedNode.attributes.downlineCount} users</span>
              </div>
            )}
          </div>
          <button 
            className="close-panel-btn"
            onClick={() => setSelectedNode(null)}
          >
            Close
          </button>
        </div>
      )}

      {/* Legend */}
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

      {/* Network Statistics */}
      <div className="network-stats">
        <div className="stat-card">
          <div className="stat-value">{JSON.stringify(treeData).match(/"name":/g)?.length - 1 || 0}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${(calculateTotalVolume(treeData) / 1000).toFixed(1)}K</div>
          <div className="stat-label">Total Volume</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{calculateMaxDepth(treeData)}</div>
          <div className="stat-label">Max Depth</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{treeData.children?.length || 0}</div>
          <div className="stat-label">Direct Children</div>
        </div>
      </div>

      {/* Export Panel */}
      <ExportPanel 
        data={generateExportData()}
        filename="orphichain-genealogy-tree"
        title="OrphiChain Network Genealogy Report"
        subtitle={`Network tree visualization generated on ${new Date().toLocaleDateString()}`}
      />
    </div>
  );
};

export default GenealogyTreeDemo;
