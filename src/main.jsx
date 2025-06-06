import React from 'react';
import ReactDOM from 'react-dom/client';
import Tree from 'react-d3-tree';

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
  
  @keyframes glow {
    0% { box-shadow: 0 0 5px rgba(0, 212, 255, 0.5); }
    50% { box-shadow: 0 0 20px rgba(0, 212, 255, 0.8); }
    100% { box-shadow: 0 0 5px rgba(0, 212, 255, 0.5); }
  }
  
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes nodePulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
  
  @keyframes searchBlink {
    0% { stroke-opacity: 1; }
    50% { stroke-opacity: 0.3; }
    100% { stroke-opacity: 1; }
  }
  
  .animate-slide-in {
    animation: slideIn 0.5s ease-out;
  }
  
  .glow-effect {
    animation: glow 3s ease-in-out infinite;
  }

  .node-pulse {
    animation: nodePulse 2s ease-in-out infinite;
  }

  /* D3 Tree Styles */
  .rd3t-tree-container {
    width: 100%;
    height: 100%;
    background: transparent;
  }
  
  .rd3t-node circle {
    fill: #00D4FF;
    stroke: #7B2CBF;
    stroke-width: 3px;
    transition: all 0.3s ease;
  }
  
  .rd3t-node:hover circle {
    fill: #00FF88;
    stroke-width: 4px;
    filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.7));
  }
  
  .rd3t-node text {
    fill: white;
    font-family: Arial, sans-serif;
    font-weight: bold;
    font-size: 14px;
    text-anchor: middle;
    dominant-baseline: central;
  }
  
  .rd3t-link {
    stroke: #00D4FF;
    stroke-width: 2px;
    fill: none;
    opacity: 0.8;
  }
  
  .rd3t-leaf-node circle {
    fill: #FF6B35;
    stroke: #00FF88;
  }
  
  .rd3t-branch-node circle {
    fill: #7B2CBF;
    stroke: #00D4FF;
  }
`;
document.head.appendChild(style);

console.log('OrphiChain Dashboard with react-d3-tree initializing...');

// Enhanced OrphiChain Dashboard with react-d3-tree
function SimpleOrphiDashboard() {
  const [orientation, setOrientation] = React.useState('vertical');
  const [showStats, setShowStats] = React.useState(true);
  const [selectedPackage, setSelectedPackage] = React.useState('$100');
  const [networkStatus, setNetworkStatus] = React.useState('online');
  const [livePrice, setLivePrice] = React.useState(2.87);
  const [treeTranslate, setTreeTranslate] = React.useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = React.useState(null);
  const [treeZoom, setTreeZoom] = React.useState(0.8);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [treeLayout, setTreeLayout] = React.useState('hierarchical');
  const [showPerformanceMetrics, setShowPerformanceMetrics] = React.useState(true);
  const [contextMenu, setContextMenu] = React.useState(null);
  const [highlightedNodes, setHighlightedNodes] = React.useState(new Set());
  const [networkActivity, setNetworkActivity] = React.useState([
    { user: 'User_0x1a2b', action: 'joined with $100 package', time: '2 min ago', color: '#7B2CBF' },
    { user: 'User_0x3c4d', action: 'upgraded to $200 package', time: '5 min ago', color: '#00FF88' },
    { user: 'User_0x5e6f', action: 'earned $25 commission', time: '8 min ago', color: '#FF6B35' },
    { user: 'User_0x7g8h', action: 'joined with $50 package', time: '12 min ago', color: '#00D4FF' }
  ]);
  const [animatedStats, setAnimatedStats] = React.useState({
    users: 0,
    volume: 0,
    depth: 0,
    children: 0
  });

  // Function to filter tree data by status
  const filterTreeByStatus = (node, status) => {
    if (!node) return null;

    // If the current node matches the status, or status is 'all'
    if (status === 'all' || node.attributes?.status === status) {
      let filteredChildren = [];
      if (node.children) {
        filteredChildren = node.children
          .map(child => filterTreeByStatus(child, status))
          .filter(child => child !== null);
      }
      // Return a new node object to avoid mutating the original treeData
      return { ...node, children: filteredChildren.length > 0 ? filteredChildren : undefined };
    } else {
      // If the current node doesn't match, but its children might
      let filteredChildren = [];
      if (node.children) {
        filteredChildren = node.children
          .map(child => filterTreeByStatus(child, status))
          .filter(child => child !== null);
      }
      // If any children match, we need to include this node as a pathway,
      // but only if it has matching children. Otherwise, filter it out.
      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null; // This node and its subtree don't match
    }
  };

  // OrphiChain Binary Tree Data Structure
  const treeData = {
    name: 'YOU',
    attributes: {
      package: selectedPackage,
      earnings: `$${(parseFloat(selectedPackage.replace('$', '')) * 0.3).toFixed(0)}`,
      level: 0,
      status: 'active'
    },
    children: [
      {
        name: 'L1',
        attributes: {
          package: '$100',
          earnings: '$30',
          level: 1,
          status: 'active'
        },
        children: [
          {
            name: 'L1-1',
            attributes: {
              package: '$50',
              earnings: '$15',
              level: 2,
              status: 'active'
            },
            children: [
              {
                name: 'L1-1-1',
                attributes: {
                  package: '$30',
                  earnings: '$9',
                  level: 3,
                  status: 'pending'
                }
              },
              {
                name: 'L1-1-2',
                attributes: {
                  package: '$100',
                  earnings: '$30',
                  level: 3,
                  status: 'active'
                }
              }
            ]
          },
          {
            name: 'L1-2',
            attributes: {
              package: '$200',
              earnings: '$60',
              level: 2,
              status: 'active'
            },
            children: [
              {
                name: 'L1-2-1',
                attributes: {
                  package: '$100',
                  earnings: '$30',
                  level: 3,
                  status: 'active'
                }
              }
            ]
          }
        ]
      },
      {
        name: 'R1',
        attributes: {
          package: '$50',
          earnings: '$15',
          level: 1,
          status: 'active'
        },
        children: [
          {
            name: 'R1-1',
            attributes: {
              package: '$100',
              earnings: '$30',
              level: 2,
              status: 'active'
            },
            children: [
              {
                name: 'R1-1-1',
                attributes: {
                  package: '$200',
                  earnings: '$60',
                  level: 3,
                  status: 'active'
                }
              },
              {
                name: 'R1-1-2',
                attributes: {
                  package: '$50',
                  earnings: '$15',
                  level: 3,
                  status: 'pending'
                }
              }
            ]
          },
          {
            name: 'R1-2',
            attributes: {
              package: '$30',
              earnings: '$9',
              level: 2,
              status: 'pending'
            }
          }
        ]
      }
    ]
  };

  const calculateTreeMetrics = (node) => {
    if (!node) { // Added a check for null or undefined node
      return {
        totalNodes: 0,
        activeNodes: 0,
        pendingNodes: 0,
        maxDepth: 0,
        totalVolume: 0,
        avgEarnings: 0 // Added avgEarnings
      };
    }
    let totalNodes = 1;
    let activeNodes = node.attributes?.status === 'active' ? 1 : 0;
    let pendingNodes = node.attributes?.status === 'pending' ? 1 : 0;
    let maxDepth = 0;
    let totalVolume = parseFloat(node.attributes?.package?.replace('$', '') || '0');

    const traverse = (currentNode, depth) => {
      maxDepth = Math.max(maxDepth, depth);
      if (currentNode.children) {
        currentNode.children.forEach(child => {
          totalNodes++;
          if (child.attributes?.status === 'active') activeNodes++;
          if (child.attributes?.status === 'pending') pendingNodes++;
          totalVolume += parseFloat(child.attributes?.package?.replace('$', '') || '0');
          traverse(child, depth + 1);
        });
      }
    };

    traverse(node, 0);
    const avgEarnings = totalNodes > 0 ? (totalVolume * 0.3 / totalNodes) : 0; // Calculate avgEarnings
    return { totalNodes, activeNodes, pendingNodes, maxDepth, totalVolume, avgEarnings }; // Added avgEarnings
  };

  const getFilteredTreeData = () => {
    let filteredData = treeData; // Use the main treeData
    if (filterStatus !== 'all') {
      filteredData = filterTreeByStatus(treeData, filterStatus);
    }
    // Ensure filteredData is not null before returning
    return filteredData || { name: 'No Data', attributes: {}, children: [] };
  };
  
  const currentMetrics = React.useMemo(() => {
    const filteredData = getFilteredTreeData();
    // Ensure calculateTreeMetrics is called with a valid node structure
    return calculateTreeMetrics(filteredData);
  }, [treeData, filterStatus, selectedPackage]); // Added selectedPackage to dependencies

  // Custom node rendering with enhanced features
  const renderCustomNodeElement = ({ nodeDatum, toggleNode }) => {
    const isRoot = nodeDatum.name === 'YOU';
    const packageAmount = nodeDatum.attributes?.package || '$0';
    const earnings = nodeDatum.attributes?.earnings || '$0';
    const status = nodeDatum.attributes?.status || 'pending';
    const level = nodeDatum.attributes?.level || 0;
    
    // Check if node matches search
    const isSearchMatch = searchTerm && 
      (nodeDatum.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       packageAmount.toLowerCase().includes(searchTerm.toLowerCase()) ||
       status.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Check if node is highlighted
    const isHighlighted = highlightedNodes.has(nodeDatum.name) || isSearchMatch;
    
    const getNodeColor = () => {
      if (isRoot) return '#00D4FF';
      if (status === 'pending') return '#FF6B35';
      switch (packageAmount) {
        case '$200': return '#00FF88';
        case '$100': return '#7B2CBF';
        case '$50': return '#00D4FF';
        case '$30': return '#FF6B35';
        default: return '#888';
      }
    };

    const getNodeSize = () => {
      if (isRoot) return 30;
      if (level === 1) return 22;
      if (level === 2) return 18;
      return 15;
    };

    return (
      <g>
        {/* Highlight Ring for Search Matches */}
        {isHighlighted && (
          <circle
            r={getNodeSize() + 12}
            fill="none"
            stroke="#FFD700"
            strokeWidth="3"
            opacity="0.8"
            strokeDasharray="8,4"
          >
            <animateTransform
              attributeName="transform"
              attributeType="XML"
              type="rotate"
              from="0 0 0"
              to="360 0 0"
              dur="3s"
              repeatCount="indefinite"
            />
          </circle>
        )}
        
        {/* Node Glow Effect for Root */}
        {isRoot && (
          <circle
            r={getNodeSize() + 8}
            fill="none"
            stroke="#00D4FF"
            strokeWidth="2"
            opacity="0.3"
            strokeDasharray="5,5"
          >
            <animateTransform
              attributeName="transform"
              attributeType="XML"
              type="rotate"
              from="0 0 0"
              to="360 0 0"
              dur="4s"
              repeatCount="indefinite"
            />
          </circle>
        )}
        
        {/* Main Node Circle */}
        <circle
          r={getNodeSize()}
          fill={getNodeColor()}
          stroke={isRoot ? '#FFD700' : isHighlighted ? '#FFD700' : '#fff'}
          strokeWidth={isRoot ? 3 : isHighlighted ? 3 : 2}
          style={{
            filter: isRoot ? 'drop-shadow(0 0 15px rgba(0, 212, 255, 0.8))' : 
                    isHighlighted ? 'drop-shadow(0 0 12px rgba(255, 215, 0, 0.6))' :
                    status === 'active' ? 'drop-shadow(0 0 8px rgba(0, 255, 136, 0.5))' : 'none',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onClick={toggleNode}
          onMouseEnter={() => setSelectedNode(nodeDatum)}
          onMouseLeave={() => setSelectedNode(null)}
          onContextMenu={(e) => handleNodeRightClick(nodeDatum, e)}
        />
        
        {/* Performance Indicator */}
        {status === 'active' && !isRoot && showPerformanceMetrics && (
          <circle
            r="3"
            cx={getNodeSize() - 3}
            cy={-getNodeSize() + 3}
            fill="#00FF88"
            stroke="#fff"
            strokeWidth="1"
          >
            <animate
              attributeName="opacity"
              values="1;0.3;1"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        )}
        
        {/* Node Label */}
        <text
          fill="white"
          strokeWidth="1"
          fontSize={isRoot ? "16" : level === 1 ? "12" : "10"}
          fontWeight="bold"
          textAnchor="middle"
          y={isRoot ? 4 : level === 1 ? 3 : 2}
        >
          {nodeDatum.name}
        </text>
        
        {/* Package Amount */}
        <text
          fill="#fff"
          fontSize={isRoot ? "10" : "8"}
          textAnchor="middle"
          y={getNodeSize() + 12}
          fontWeight="bold"
        >
          {packageAmount}
        </text>
        
        {/* Earnings */}
        <text
          fill="#00FF88"
          fontSize={isRoot ? "9" : "7"}
          textAnchor="middle"
          y={getNodeSize() + 22}
          fontWeight="bold"
        >
          {earnings}
        </text>
        
        {/* Level Indicator */}
        {!isRoot && (
          <text
            fill="#B0B0B0"
            fontSize="6"
            textAnchor="middle"
            y={-getNodeSize() - 8}
          >
            L{level}
          </text>
        )}
      </g>
    );
  };

  // Set tree center on mount
  React.useEffect(() => {
    const updateTreePosition = () => {
      const containerWidth = 800; // Fixed width for consistency
      const containerHeight = 500; // Fixed height matching container
      setTreeTranslate({
        x: containerWidth / 2,
        y: orientation === 'vertical' ? 80 : containerHeight / 2
      });
    };

    updateTreePosition();
    window.addEventListener('resize', updateTreePosition);
    return () => window.removeEventListener('resize', updateTreePosition);
  }, [orientation]);

  // Handle node click events
  const handleNodeClick = (nodeData) => {
    setSelectedNode(nodeData);
    console.log('Node clicked:', nodeData);
  };

  // Simulate live price updates
  React.useEffect(() => {
    const priceTimer = setInterval(() => {
      setLivePrice(prev => {
        const change = (Math.random() - 0.5) * 0.1;
        return Math.max(0.1, +(prev + change).toFixed(4));
      });
    }, 3000);

    return () => clearInterval(priceTimer);
  }, []);

  // Simulate real-time network activity
  React.useEffect(() => {
    const activityTimer = setInterval(() => {
      const actions = [
        'joined with $30 package',
        'joined with $50 package', 
        'joined with $100 package',
        'joined with $200 package',
        'upgraded package',
        'earned commission',
        'achieved milestone'
      ];

      const colors = ['#FF6B35', '#00D4FF', '#7B2CBF', '#00FF88'];
      
      const newActivity = {
        user: `User_0x${Math.random().toString(16).substr(2, 4)}`,
        action: actions[Math.floor(Math.random() * actions.length)],
        time: 'just now',
        color: colors[Math.floor(Math.random() * colors.length)]
      };

      setNetworkActivity(prev => [newActivity, ...prev.slice(0, 3)]);
    }, 8000);

    return () => clearInterval(activityTimer);
  }, []);

  // Animate counters on mount
  React.useEffect(() => {
    const targets = {
      users: 1247,
      volume: 892340,
      depth: 12,
      children: 23
    };

    const duration = 2000; // 2 seconds
    const steps = 60;
    const stepTime = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = Math.min(currentStep / steps, 1);
      
      setAnimatedStats({
        users: Math.floor(targets.users * progress),
        volume: Math.floor(targets.volume * progress),
        depth: Math.floor(targets.depth * progress),
        children: Math.floor(targets.children * progress)
      });

      if (progress >= 1) {
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, []);

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div style={{ 
      padding: '20px',
      background: 'linear-gradient(135deg, #0A0A1E 0%, #1A1A3E 100%)',
      color: 'white',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header with Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div>
          <h1 style={{ 
            color: '#00D4FF', 
            fontSize: '2.5rem',
            margin: '0 0 10px 0'
          }}>
            🚀 OrphiChain Dashboard
          </h1>
          <p style={{ color: '#B0B0B0', fontSize: '1.1rem', margin: 0 }}>
            Enhanced Binary Tree Genealogy & Analytics Platform
          </p>
          
          {/* Live Status Indicators */}
          <div style={{ 
            display: 'flex', 
            gap: '15px', 
            marginTop: '10px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '5px',
              background: 'rgba(0, 255, 136, 0.1)',
              padding: '5px 10px',
              borderRadius: '20px',
              border: '1px solid #00FF88'
            }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                background: '#00FF88',
                animation: 'pulse 2s infinite'
              }}></div>
              <span style={{ color: '#00FF88', fontSize: '0.8rem' }}>Network Online</span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '5px',
              background: 'rgba(0, 212, 255, 0.1)',
              padding: '5px 10px',
              borderRadius: '20px',
              border: '1px solid #00D4FF'
            }}>
              <span style={{ color: '#00D4FF', fontSize: '0.8rem' }}>
                USDT: ${livePrice}
              </span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '5px',
              background: 'rgba(255, 107, 53, 0.1)',
              padding: '5px 10px',
              borderRadius: '20px',
              border: '1px solid #FF6B35'
            }}>
              <span style={{ color: '#FF6B35', fontSize: '0.8rem' }}>
                {animatedStats.users} Active Users
              </span>
            </div>
          </div>
        </div>
        
        {/* Toggle Controls */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Advanced Search */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="🔍 Search nodes..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value) {
                  const matches = searchTreeNodes(treeData, e.target.value);
                  setHighlightedNodes(new Set(matches.map(node => node.name)));
                } else {
                  setHighlightedNodes(new Set());
                }
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid #00D4FF',
                borderRadius: '20px',
                padding: '8px 15px',
                color: 'white',
                fontSize: '0.9rem',
                minWidth: '200px'
              }}
            />
            
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid #7B2CBF',
                borderRadius: '20px',
                padding: '8px 15px',
                color: 'white',
                fontSize: '0.9rem'
              }}
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="pending">Pending Only</option>
            </select>
          </div>
          
          {/* Export Controls */}
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              onClick={() => exportTreeData('png')}
              style={{
                background: 'linear-gradient(45deg, #00FF88, #00D4FF)',
                color: 'white',
                border: 'none',
                borderRadius: '15px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '600'
              }}
              title="Export as PNG"
            >
              📸 PNG
            </button>
            
            <button
              onClick={() => exportTreeData('svg')}
              style={{
                background: 'linear-gradient(45deg, #7B2CBF, #FF6B35)',
                color: 'white',
                border: 'none',
                borderRadius: '15px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '600'
              }}
              title="Export as SVG"
            >
              🎨 SVG
            </button>
            
            <button
              onClick={() => exportTreeData('json')}
              style={{
                background: 'linear-gradient(45deg, #FF6B35, #00FF88)',
                color: 'white',
                border: 'none',
                borderRadius: '15px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '600'
              }}
              title="Export Data as JSON"
            >
              📊 JSON
            </button>
          </div>
          
          {/* Keyboard Shortcuts Help */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '0.8rem',
            color: '#FFD700',
            maxWidth: '300px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>⌨️ Shortcuts:</div>
            <div style={{ color: '#B0B0B0', lineHeight: '1.3' }}>
              <div>Ctrl/⌘+F: Search | Ctrl/⌘+E: Export PNG</div>
              <div>Ctrl/⌘+R: Rotate | Ctrl/⌘+H: Toggle Stats | ESC: Clear</div>
            </div>
          </div>
          
          <button
            onClick={() => setShowPerformanceMetrics(!showPerformanceMetrics)}
            style={{
              background: showPerformanceMetrics ? '#00FF88' : 'rgba(255, 255, 255, 0.1)',
              color: showPerformanceMetrics ? '#0A0A1E' : 'white',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
          >
            {showPerformanceMetrics ? '📈 Metrics ON' : '📈 Metrics OFF'}
          </button>

          <button
            onClick={() => setShowStats(!showStats)}
            style={{
              background: showStats ? '#00FF88' : 'rgba(255, 255, 255, 0.1)',
              color: showStats ? '#0A0A1E' : 'white',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
          >
            {showStats ? '📊 Stats ON' : '📊 Stats OFF'}
          </button>
          
          <button
            onClick={() => setOrientation(orientation === 'vertical' ? 'horizontal' : 'vertical')}
            style={{
              background: 'linear-gradient(45deg, #7B2CBF, #00D4FF)',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
          >
            🔄 {orientation === 'vertical' ? 'Switch to Horizontal' : 'Switch to Vertical'}
          </button>
        </div>
      </div>

      {/* Statistics Grid - Conditional */}
      {showStats && (
        <div className="animate-slide-in" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div style={{
            background: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid #00D4FF',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            transition: 'transform 0.3s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.target.style.transform = 'translateY(-5px)'}
          onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <h3 style={{ color: '#00D4FF', margin: '0 0 10px 0' }}>Total Users</h3>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{formatNumber(animatedStats.users)}</div>
            <small style={{ color: '#B0B0B0' }}>Active network members</small>
          </div>

          <div style={{
            background: 'rgba(255, 107, 53, 0.1)',
            border: '1px solid #FF6B35',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            transition: 'transform 0.3s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.target.style.transform = 'translateY(-5px)'}
          onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <h3 style={{ color: '#FF6B35', margin: '0 0 10px 0' }}>Total Volume</h3>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${formatNumber(animatedStats.volume)}</div>
            <small style={{ color: '#B0B0B0' }}>Network transaction volume</small>
          </div>

          <div style={{
            background: 'rgba(123, 44, 191, 0.1)',
            border: '1px solid #7B2CBF',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            transition: 'transform 0.3s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.target.style.transform = 'translateY(-5px)'}
          onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <h3 style={{ color: '#7B2CBF', margin: '0 0 10px 0' }}>Max Depth</h3>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{animatedStats.depth}</div>
            <small style={{ color: '#B0B0B0' }}>Network genealogy levels</small>
          </div>

          <div style={{
            background: 'rgba(0, 255, 136, 0.1)',
            border: '1px solid #00FF88',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            transition: 'transform 0.3s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.target.style.transform = 'translateY(-5px)'}
          onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <h3 style={{ color: '#00FF88', margin: '0 0 10px 0' }}>Direct Children</h3>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{animatedStats.children}</div>
            <small style={{ color: '#B0B0B0' }}>Your direct referrals</small>
          </div>
        </div>
      )}

      {/* Advanced Tree Analytics Panel */}
      {showPerformanceMetrics && (
        <div className="animate-slide-in" style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '15px',
          padding: '20px',
          marginBottom: '20px',
          border: '1px solid rgba(0, 212, 255, 0.2)'
        }}>
          <h3 style={{ 
            color: '#00D4FF', 
            textAlign: 'center', 
            marginBottom: '20px',
            fontSize: '1.2rem'
          }}>
            🎯 Advanced Tree Analytics
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '15px'
          }}>
            {/* Real-time Metrics */}
            <div style={{
              background: 'rgba(0, 212, 255, 0.1)',
              borderRadius: '10px',
              padding: '15px',
              textAlign: 'center',
              border: '1px solid #00D4FF'
            }}>
              <div style={{ color: '#00D4FF', fontSize: '0.9rem', marginBottom: '5px' }}>
                🌐 Total Network Nodes
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white' }}>
                {currentMetrics.totalNodes}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#B0B0B0' }}>
                Active in network
              </div>
            </div>

            <div style={{
              background: 'rgba(0, 255, 136, 0.1)',
              borderRadius: '10px',
              padding: '15px',
              textAlign: 'center',
              border: '1px solid #00FF88'
            }}>
              <div style={{ color: '#00FF88', fontSize: '0.9rem', marginBottom: '5px' }}>
                ✅ Active Rate
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white' }}>
                {((currentMetrics.activeNodes / currentMetrics.totalNodes) * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.7rem', color: '#B0B0B0' }}>
                {currentMetrics.activeNodes}/{currentMetrics.totalNodes} nodes
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 107, 53, 0.1)',
              borderRadius: '10px',
              padding: '15px',
              textAlign: 'center',
              border: '1px solid #FF6B35'
            }}>
              <div style={{ color: '#FF6B35', fontSize: '0.9rem', marginBottom: '5px' }}>
                ⏳ Pending Nodes
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white' }}>
                {currentMetrics.pendingNodes}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#B0B0B0' }}>
                Awaiting activation
              </div>
            </div>

            <div style={{
              background: 'rgba(123, 44, 191, 0.1)',
              borderRadius: '10px',
              padding: '15px',
              textAlign: 'center',
              border: '1px solid #7B2CBF'
            }}>
              <div style={{ color: '#7B2CBF', fontSize: '0.9rem', marginBottom: '5px' }}>
                💎 Avg Node Value
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white' }}>
                ${(currentMetrics.totalVolume / currentMetrics.totalNodes).toFixed(0)}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#B0B0B0' }}>
                Per network position
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 215, 0, 0.1)',
              borderRadius: '10px',
              padding: '15px',
              textAlign: 'center',
              border: '1px solid #FFD700'
            }}>
              <div style={{ color: '#FFD700', fontSize: '0.9rem', marginBottom: '5px' }}>
                🏆 Network Efficiency
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white' }}>
                {(((currentMetrics.activeNodes / currentMetrics.totalNodes) * 
                   (currentMetrics.totalVolume / 1000)) * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.7rem', color: '#B0B0B0' }}>
                Performance score
              </div>
            </div>

            <div style={{
              background: 'rgba(0, 212, 255, 0.1)',
              borderRadius: '10px',
              padding: '15px',
              textAlign: 'center',
              border: '1px solid #00D4FF'
            }}>
              <div style={{ color: '#00D4FF', fontSize: '0.9rem', marginBottom: '5px' }}>
                📊 Tree Depth
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white' }}>
                {currentMetrics.maxDepth}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#B0B0B0' }}>
                Maximum levels deep
              </div>
            </div>
          </div>
          
          {/* Search Results */}
          {searchTerm && highlightedNodes.size > 0 && (
            <div style={{
              marginTop: '20px',
              background: 'rgba(255, 215, 0, 0.1)',
              borderRadius: '10px',
              padding: '15px',
              border: '1px solid #FFD700'
            }}>
              <div style={{ color: '#FFD700', fontSize: '1rem', marginBottom: '10px' }}>
                🔍 Search Results for "{searchTerm}"
              </div>
              <div style={{ color: '#B0B0B0', fontSize: '0.9rem' }}>
                Found {highlightedNodes.size} matching nodes: {Array.from(highlightedNodes).join(', ')}
              </div>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setHighlightedNodes(new Set());
                }}
                style={{
                  background: 'linear-gradient(45deg, #FFD700, #FF6B35)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '15px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  marginTop: '10px'
                }}
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: '25px',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#00D4FF', marginBottom: '15px' }}>
          🌳 Binary Tree Genealogy Structure
        </h2>
        <p style={{ color: '#B0B0B0', marginBottom: '15px' }}>
          Enhanced genealogy tree with orientation toggle and comprehensive analytics
        </p>
        
        {/* Tree Status Indicators */}
        <div style={{ 
          display: 'flex', 
          gap: '15px', 
          justifyContent: 'center', 
          marginBottom: '15px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            background: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid #00D4FF',
            borderRadius: '20px',
            padding: '5px 15px',
            fontSize: '0.9rem',
            color: '#00D4FF'
          }}>
            📊 Orientation: {orientation}
          </div>
          
          {filterStatus !== 'all' && (
            <div style={{
              background: 'rgba(123, 44, 191, 0.1)',
              border: '1px solid #7B2CBF',
              borderRadius: '20px',
              padding: '5px 15px',
              fontSize: '0.9rem',
              color: '#7B2CBF'
            }}>
              🔄 Filter: {filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
            </div>
          )}
        </div>
        
        {/* Tree Component */}
        <div style={{
          width: '100%',
          height: '500px',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(255, 255, 255, 0.02)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)'
        }}>
          <Tree
            data={treeData}
            orientation={orientation}
            translate={treeTranslate}
            zoom={treeZoom}
            onNodeClick={handleNodeClick}
            renderCustomNodeElement={renderCustomNodeElement}
            pathFunc="diagonal"
            styles={{
              nodes: {
                node: {
                  stroke: 'none',
                  strokeWidth: 0,
                  fill: 'none'
                },
                leafNode: {
                  stroke: 'none',
                  strokeWidth: 0,
                  fill: 'none'
                }
              },
              links: {
                stroke: '#00D4FF',
                strokeWidth: 2,
                fill: 'none',
                opacity: 0.8
              }
            }}
          />
        </div>
      </div>
      
      {/* Context Menu for Node Actions */}
      {contextMenu && (
        <div style={{
          position: 'absolute',
          top: contextMenu.y,
          left: contextMenu.x,
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          padding: '10px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
          zIndex: 1000
        }}
        onMouseLeave={() => setContextMenu(null)}
        >
          <div style={{ color: '#FFD700', fontSize: '0.9rem', marginBottom: '8px' }}>
            ⚙️ Node Actions
          </div>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px' 
          }}>
            <button
              onClick={() => {
                handleNodeEdit(selectedNode);
                setContextMenu(null);
              }}
              style={{
                background: 'linear-gradient(45deg, #00FF88, #00D4FF)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '500',
                transition: 'background 0.3s ease'
              }}
              title="Edit Node"
            >
              ✏️ Edit Node
            </button>
            
            <button
              onClick={() => {
                handleNodeDelete(selectedNode);
                setContextMenu(null);
              }}
              style={{
                background: 'linear-gradient(45deg, #FF6B35, #FF3B30)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '500',
                transition: 'background 0.3s ease'
              }}
              title="Delete Node"
            >
              🗑️ Delete Node
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<SimpleOrphiDashboard />);
