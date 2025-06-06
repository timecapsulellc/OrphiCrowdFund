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

  // Advanced Tree Helper Functions
  const searchTreeNodes = (node, term) => {
    if (!term) return [];
    
    let matches = [];
    if (node.name.toLowerCase().includes(term.toLowerCase()) ||
        node.attributes?.package?.toLowerCase().includes(term.toLowerCase()) ||
        node.attributes?.status?.toLowerCase().includes(term.toLowerCase())) {
      matches.push(node);
    }
    
    if (node.children) {
      node.children.forEach(child => {
        matches = matches.concat(searchTreeNodes(child, term));
      });
    }
    
    return matches;
  };

  const filterTreeByStatus = (node, status) => {
    if (status === 'all') return node;
    
    const filteredNode = { ...node };
    
    // Always include the root node and filter children recursively
    if (node.children) {
      filteredNode.children = node.children
        .filter(child => child.attributes?.status === status || child.name === 'YOU')
        .map(child => filterTreeByStatus(child, status));
    }
    
    return filteredNode;
  };

  const calculateTreeMetrics = (node) => {
    if (!node) {
      return {
        totalNodes: 0,
        activeNodes: 0,
        pendingNodes: 0,
        totalVolume: 0,
        maxDepth: 0,
        avgEarnings: 0
      };
    }
    
    let metrics = {
      totalNodes: 0,
      activeNodes: 0,
      pendingNodes: 0,
      totalVolume: 0,
      maxDepth: 0,
      avgEarnings: 0
    };
    
    const traverse = (currentNode, depth = 0) => {
      metrics.totalNodes++;
      metrics.maxDepth = Math.max(metrics.maxDepth, depth);
      
      if (currentNode.attributes?.status === 'active') {
        metrics.activeNodes++;
      } else if (currentNode.attributes?.status === 'pending') {
        metrics.pendingNodes++;
      }
      
      const packageValue = parseFloat(currentNode.attributes?.package?.replace('$', '') || '0');
      metrics.totalVolume += packageValue;
      
      if (currentNode.children) {
        currentNode.children.forEach(child => traverse(child, depth + 1));
      }
    };
    
    traverse(node);
    metrics.avgEarnings = metrics.totalNodes > 0 ? (metrics.totalVolume * 0.3 / metrics.totalNodes) : 0;
    return metrics;
  };

  const exportTreeData = (format) => {
    const treeElement = document.querySelector('.rd3t-tree-container svg');
    if (!treeElement) return;
    
    switch (format) {
      case 'png':
        // Convert SVG to PNG
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const svgData = new XMLSerializer().serializeToString(treeElement);
        const img = new Image();
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          const link = document.createElement('a');
          link.download = 'orphichain-tree.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
          
          URL.revokeObjectURL(url);
        };
        img.src = url;
        break;
        
      case 'svg':
        const svgString = new XMLSerializer().serializeToString(treeElement);
        const svgBlob2 = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const link2 = document.createElement('a');
        link2.download = 'orphichain-tree.svg';
        link2.href = URL.createObjectURL(svgBlob2);
        link2.click();
        break;
        
      case 'json':
        const jsonData = JSON.stringify(treeData, null, 2);
        const jsonBlob = new Blob([jsonData], { type: 'application/json' });
        const link3 = document.createElement('a');
        link3.download = 'orphichain-tree-data.json';
        link3.href = URL.createObjectURL(jsonBlob);
        link3.click();
        break;
    }
  };

  // Simple tree data for testing
  const simpleTreeData = {
    name: 'YOU',
    attributes: {
      package: '$100',
      earnings: '$30',
      level: 0,
      status: 'active'
    },
    children: [
      {
        name: 'L1',
        attributes: { package: '$100', earnings: '$30', level: 1, status: 'active' }
      },
      {
        name: 'R1',
        attributes: { package: '$50', earnings: '$15', level: 1, status: 'active' }
      }
    ]
  };

  // Get filtered tree data
  const getFilteredTreeData = () => {
    // Use simple tree for now to debug
    const dataToUse = simpleTreeData;
    
    // Add debug logging
    console.log('Using tree data:', dataToUse);
    console.log('Filter status:', filterStatus);
    console.log('Tree translate:', treeTranslate);
    
    return dataToUse;
  };

  // Calculate current tree metrics
  const currentMetrics = React.useMemo(() => {
    const filteredData = getFilteredTreeData();
    return calculateTreeMetrics(filteredData);
  }, [filterStatus]);

  // Handle node right-click
  const handleNodeRightClick = (nodeData, event) => {
    event.preventDefault();
    setContextMenu({
      node: nodeData,
      x: event.clientX,
      y: event.clientY
    });
  };

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'f':
            event.preventDefault();
            document.querySelector('input[placeholder*="Search"]')?.focus();
            break;
          case 'e':
            event.preventDefault();
            exportTreeData('png');
            break;
          case 'r':
            event.preventDefault();
            setOrientation(orientation === 'vertical' ? 'horizontal' : 'vertical');
            break;
          case 'h':
            event.preventDefault();
            setShowStats(!showStats);
            break;
        }
      }
      if (event.key === 'Escape') {
        setContextMenu(null);
        setSelectedNode(null);
        setSearchTerm('');
        setHighlightedNodes(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [orientation, showStats]);

  // Close context menu on outside click
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenu && !event.target.closest('.context-menu')) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);
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
              🔍 Filter: {filterStatus}
            </div>
          )}
          
          {searchTerm && (
            <div style={{
              background: 'rgba(255, 215, 0, 0.1)',
              border: '1px solid #FFD700',
              borderRadius: '20px',
              padding: '5px 15px',
              fontSize: '0.9rem',
              color: '#FFD700'
            }}>
              🔍 Search: "{searchTerm}" ({highlightedNodes.size} matches)
            </div>
          )}
          
          <div style={{
            background: 'rgba(0, 255, 136, 0.1)',
            border: '1px solid #00FF88',
            borderRadius: '20px',
            padding: '5px 15px',
            fontSize: '0.9rem',
            color: '#00FF88'
          }}>
            📈 Zoom: {(treeZoom * 100).toFixed(0)}%
          </div>
        </div>

        {/* Enhanced D3 Tree Visualization */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '15px',
          padding: '10px',
          marginBottom: '20px',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          height: '500px',
          width: '100%',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '20px',
            zIndex: 10,
            background: 'rgba(0, 212, 255, 0.1)',
            padding: '8px 15px',
            borderRadius: '20px',
            border: '1px solid #00D4FF',
            color: '#00D4FF',
            fontSize: '0.9rem',
            fontWeight: 'bold'
          }}>
            🌳 Interactive Binary Tree Network
          </div>
          
          <div style={{
            width: '100%',
            height: '100%',
            position: 'relative'
          }}>
            <Tree
              data={getFilteredTreeData()}
              orientation={orientation}
              translate={treeTranslate}
              pathFunc="diagonal"
              nodeSize={{ x: 150, y: 100 }}
              separation={{ siblings: 1.5, nonSiblings: 2 }}
              zoom={treeZoom}
              scaleExtent={{ min: 0.2, max: 3 }}
              transitionDuration={500}
              depthFactor={orientation === 'vertical' ? 120 : 200}
              renderCustomNodeElement={renderCustomNodeElement}
              collapsible={false}
              initialDepth={3}
              styles={{
                links: {
                  stroke: '#00D4FF',
                  strokeWidth: 2,
                  strokeOpacity: 0.8
                }
              }}
            />
          </div>
          
          {/* Right-Click Context Menu */}
          {contextMenu && (
            <div
              className="context-menu"
              style={{
                position: 'fixed',
                top: contextMenu.y,
                left: contextMenu.x,
                background: 'rgba(0, 0, 0, 0.95)',
                border: '2px solid #00D4FF',
                borderRadius: '10px',
                padding: '10px',
                zIndex: 1000,
                boxShadow: '0 8px 25px rgba(0, 212, 255, 0.4)',
                minWidth: '200px'
              }}
            >
              <div style={{
                color: '#00D4FF',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                marginBottom: '10px',
                paddingBottom: '8px',
                borderBottom: '1px solid rgba(0, 212, 255, 0.3)'
              }}>
                {contextMenu.node.name} Actions
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(contextMenu.node, null, 2));
                    setContextMenu(null);
                    alert('Node data copied to clipboard!');
                  }}
                  style={{
                    background: 'rgba(0, 255, 136, 0.2)',
                    border: '1px solid #00FF88',
                    borderRadius: '5px',
                    color: 'white',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    textAlign: 'left'
                  }}
                >
                  📋 Copy Node Data
                </button>
                
                <button
                  onClick={() => {
                    setHighlightedNodes(new Set([contextMenu.node.name]));
                    setContextMenu(null);
                  }}
                  style={{
                    background: 'rgba(255, 215, 0, 0.2)',
                    border: '1px solid #FFD700',
                    borderRadius: '5px',
                    color: 'white',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    textAlign: 'left'
                  }}
                >
                  ⭐ Highlight Node
                </button>
                
                <button
                  onClick={() => {
                    console.log('Viewing details for:', contextMenu.node);
                    setSelectedNode(contextMenu.node);
                    setContextMenu(null);
                  }}
                  style={{
                    background: 'rgba(0, 212, 255, 0.2)',
                    border: '1px solid #00D4FF',
                    borderRadius: '5px',
                    color: 'white',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    textAlign: 'left'
                  }}
                >
                  👁️ View Details
                </button>
                
                <button
                  onClick={() => {
                    const siblingNodes = [];
                    const findSiblings = (node, targetName, parent = null) => {
                      if (parent && parent.children) {
                        parent.children.forEach(child => {
                          if (child.name !== targetName) {
                            siblingNodes.push(child.name);
                          }
                        });
                      }
                      if (node.children) {
                        node.children.forEach(child => findSiblings(child, targetName, node));
                      }
                    };
                    findSiblings(treeData, contextMenu.node.name);
                    setHighlightedNodes(new Set(siblingNodes));
                    setContextMenu(null);
                  }}
                  style={{
                    background: 'rgba(123, 44, 191, 0.2)',
                    border: '1px solid #7B2CBF',
                    borderRadius: '5px',
                    color: 'white',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    textAlign: 'left'
                  }}
                >
                  👥 Show Siblings
                </button>
              </div>
            </div>
          )}
          
          {/* Node Information Tooltip */}
          {selectedNode && (
            <div style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(0, 0, 0, 0.9)',
              border: '2px solid #00D4FF',
              borderRadius: '10px',
              padding: '15px',
              color: 'white',
              fontSize: '0.9rem',
              maxWidth: '200px',
              zIndex: 20,
              boxShadow: '0 8px 25px rgba(0, 212, 255, 0.4)'
            }}>
              <h4 style={{ 
                color: '#00D4FF', 
                margin: '0 0 10px 0',
                fontSize: '1rem'
              }}>
                {selectedNode.name === 'YOU' ? '👑 Your Position' : `📍 ${selectedNode.name}`}
              </h4>
              <div style={{ marginBottom: '8px' }}>
                <strong>Package:</strong> {selectedNode.attributes?.package || 'N/A'}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Earnings:</strong> <span style={{ color: '#00FF88' }}>
                  {selectedNode.attributes?.earnings || 'N/A'}
                </span>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Level:</strong> {selectedNode.attributes?.level || 0}
              </div>
              <div>
                <strong>Status:</strong> <span style={{ 
                  color: selectedNode.attributes?.status === 'active' ? '#00FF88' : '#FF6B35'
                }}>
                  {selectedNode.attributes?.status || 'pending'}
                </span>
              </div>
            </div>
          )}
          
          {/* Tree Controls */}
          <div style={{
            position: 'absolute',
            bottom: '15px',
            right: '20px',
            display: 'flex',
            gap: '10px',
            zIndex: 10
          }}>
            <button
              onClick={() => setTreeZoom(Math.min(treeZoom + 0.2, 2))}
              style={{
                background: 'linear-gradient(45deg, #00FF88, #00D4FF)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                cursor: 'pointer',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0, 255, 136, 0.3)'
              }}
            >
              +
            </button>
            
            <button
              onClick={() => setTreeZoom(Math.max(treeZoom - 0.2, 0.3))}
              style={{
                background: 'linear-gradient(45deg, #FF6B35, #7B2CBF)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                cursor: 'pointer',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)'
              }}
            >
              -
            </button>
            
            <button
              onClick={() => setOrientation(orientation === 'vertical' ? 'horizontal' : 'vertical')}
              style={{
                background: 'linear-gradient(45deg, #00D4FF, #7B2CBF)',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                padding: '8px 15px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0, 212, 255, 0.3)',
                minWidth: '100px'
              }}
            >
              {orientation === 'vertical' ? '↔️ Horizontal' : '↕️ Vertical'}
            </button>
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          marginTop: '20px'
        }}>
          <h3 style={{ 
            width: '100%', 
            textAlign: 'center', 
            color: '#00D4FF', 
            marginBottom: '15px',
            fontSize: '1.2rem'
          }}>
            📦 Package Tiers
          </h3>
          {[
            { amount: '$30', color: '#FF6B35', desc: 'Starter' },
            { amount: '$50', color: '#00D4FF', desc: 'Basic' },
            { amount: '$100', color: '#7B2CBF', desc: 'Premium' },
            { amount: '$200', color: '#00FF88', desc: 'Elite' }
          ].map(({ amount, color, desc }) => (
            <div 
              key={amount} 
              onClick={() => setSelectedPackage(amount)}
              style={{
                background: selectedPackage === amount 
                  ? `linear-gradient(45deg, ${color}, #00D4FF)` 
                  : `rgba(${color === '#FF6B35' ? '255, 107, 53' : color === '#00D4FF' ? '0, 212, 255' : color === '#7B2CBF' ? '123, 44, 191' : '0, 255, 136'}, 0.2)`,
                border: `2px solid ${selectedPackage === amount ? color : 'rgba(255,255,255,0.1)'}`,
                color: 'white',
                padding: '15px 20px',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                textAlign: 'center',
                minWidth: '100px',
                transform: selectedPackage === amount ? 'scale(1.05)' : 'scale(1)',
                boxShadow: selectedPackage === amount ? `0 8px 25px rgba(${color === '#FF6B35' ? '255, 107, 53' : color === '#00D4FF' ? '0, 212, 255' : color === '#7B2CBF' ? '123, 44, 191' : '0, 255, 136'}, 0.4)` : 'none'
              }}
            >
              <div style={{ fontSize: '1.2rem', marginBottom: '5px' }}>{amount}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* Enhanced Network Statistics Panel */}
        <div style={{
          marginTop: '20px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '15px',
          padding: '20px',
          border: '1px solid rgba(0, 212, 255, 0.2)'
        }}>
          <h3 style={{ 
            color: '#00D4FF', 
            textAlign: 'center', 
            marginBottom: '20px',
            fontSize: '1.2rem'
          }}>
            📊 Network Tree Analytics
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px'
          }}>
            {/* Total Nodes */}
            <div style={{
              background: 'rgba(0, 212, 255, 0.1)',
              borderRadius: '10px',
              padding: '15px',
              textAlign: 'center',
              border: '1px solid #00D4FF'
            }}>
              <div style={{ color: '#00D4FF', fontSize: '0.9rem', marginBottom: '5px' }}>
                🌟 Total Nodes
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                12
              </div>
              <div style={{ fontSize: '0.7rem', color: '#B0B0B0' }}>
                Active network positions
              </div>
            </div>

            {/* Tree Depth */}
            <div style={{
              background: 'rgba(255, 107, 53, 0.1)',
              borderRadius: '10px',
              padding: '15px',
              textAlign: 'center',
              border: '1px solid #FF6B35'
            }}>
              <div style={{ color: '#FF6B35', fontSize: '0.9rem', marginBottom: '5px' }}>
                📏 Max Depth
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                3
              </div>
              <div style={{ fontSize: '0.7rem', color: '#B0B0B0' }}>
                Genealogy levels
              </div>
            </div>

            {/* Binary Balance */}
            <div style={{
              background: 'rgba(123, 44, 191, 0.1)',
              borderRadius: '10px',
              padding: '15px',
              textAlign: 'center',
              border: '1px solid #7B2CBF'
            }}>
              <div style={{ color: '#7B2CBF', fontSize: '0.9rem', marginBottom: '5px' }}>
                ⚖️ Tree Balance
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                L6:R5
              </div>
              <div style={{ fontSize: '0.7rem', color: '#B0B0B0' }}>
                Left vs Right leg
              </div>
            </div>

            {/* Total Volume */}
            <div style={{
              background: 'rgba(0, 255, 136, 0.1)',
              borderRadius: '10px',
              padding: '15px',
              textAlign: 'center',
              border: '1px solid #00FF88'
            }}>
              <div style={{ color: '#00FF88', fontSize: '0.9rem', marginBottom: '5px' }}>
                💰 Tree Volume
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                $1,240
              </div>
              <div style={{ fontSize: '0.7rem', color: '#B0B0B0' }}>
                Combined package value
              </div>
            </div>
          </div>
        </div>

        {/* Network Growth Progress */}
        <div style={{
          marginTop: '30px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '15px',
          padding: '20px',
          border: '1px solid rgba(0, 212, 255, 0.2)'
        }}>
          <h3 style={{ 
            color: '#00D4FF', 
            textAlign: 'center', 
            marginBottom: '20px',
            fontSize: '1.2rem'
          }}>
            📊 Network Growth Progress
          </h3>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '5px',
              color: '#B0B0B0',
              fontSize: '0.9rem'
            }}>
              <span>Current: {animatedStats.users} users</span>
              <span>Target: 2,000 users</span>
            </div>
            
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              height: '20px',
              overflow: 'hidden'
            }}>
              <div style={{
                background: 'linear-gradient(90deg, #00D4FF, #00FF88)',
                height: '100%',
                width: `${(animatedStats.users / 2000) * 100}%`,
                borderRadius: '10px',
                transition: 'width 2s ease-out',
                boxShadow: '0 0 10px rgba(0, 212, 255, 0.5)'
              }}></div>
            </div>
            
            <div style={{ 
              textAlign: 'center', 
              marginTop: '10px',
              color: '#00FF88',
              fontSize: '0.9rem',
              fontWeight: 'bold'
            }}>
              {((animatedStats.users / 2000) * 100).toFixed(1)}% Complete
            </div>
          </div>
        </div>

        {/* Enhanced Network Activity Feed */}
        <div style={{
          marginTop: '30px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '15px',
          padding: '20px',
          border: '1px solid rgba(0, 212, 255, 0.2)'
        }}>
          <h3 style={{ 
            color: '#00D4FF', 
            textAlign: 'center', 
            marginBottom: '20px',
            fontSize: '1.2rem'
          }}>
            🔥 Live Network Activity
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {networkActivity.map((activity, index) => (
              <div 
                key={index}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: `1px solid ${activity.color}20`,
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = `${activity.color}15`;
                  e.target.style.transform = 'translateX(5px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.target.style.transform = 'translateX(0)';
                }}
              >
                <div>
                  <span style={{ color: activity.color, fontWeight: 'bold' }}>{activity.user}</span>
                  <span style={{ color: '#B0B0B0', marginLeft: '8px' }}>{activity.action}</span>
                </div>
                <span style={{ color: '#888', fontSize: '0.8rem' }}>{activity.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Enhanced Earnings Calculator */}
        <div style={{
          marginTop: '30px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px'
        }}>
          {/* Personal Earnings */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(123, 44, 191, 0.1))',
            borderRadius: '15px',
            padding: '20px',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            textAlign: 'center'
          }}>
            <h4 style={{ color: '#00D4FF', marginBottom: '15px' }}>💰 Your Earnings</h4>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#00FF88', marginBottom: '10px' }}>
              ${(parseFloat(selectedPackage.replace('$', '')) * 0.3).toFixed(0)}
            </div>
            <p style={{ color: '#B0B0B0', fontSize: '0.9rem' }}>
              Direct commission from {selectedPackage} package
            </p>
            <div style={{ 
              background: 'rgba(0, 255, 136, 0.1)', 
              borderRadius: '8px', 
              padding: '10px', 
              marginTop: '10px' 
            }}>
              <small style={{ color: '#00FF88' }}>
                Total Lifetime: ${(animatedStats.volume * 0.15).toFixed(0)}
              </small>
            </div>
          </div>

          {/* Network Growth */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(0, 255, 136, 0.1))',
            borderRadius: '15px',
            padding: '20px',
            border: '1px solid rgba(255, 107, 53, 0.3)',
            textAlign: 'center'
          }}>
            <h4 style={{ color: '#FF6B35', marginBottom: '15px' }}>📈 Network Growth</h4>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#FF6B35', marginBottom: '10px' }}>
              +{Math.floor(animatedStats.users * 0.1)}%
            </div>
            <p style={{ color: '#B0B0B0', fontSize: '0.9rem' }}>
              Growth this month
            </p>
            <div style={{ 
              background: 'rgba(255, 107, 53, 0.1)', 
              borderRadius: '8px', 
              padding: '10px', 
              marginTop: '10px' 
            }}>
              <small style={{ color: '#FF6B35' }}>
                Next milestone: {animatedStats.users + 253} users
              </small>
            </div>
          </div>
        </div>

      </div>

      <div style={{
        marginTop: '30px',
        textAlign: 'center',
        color: '#B0B0B0',
        background: 'rgba(0, 212, 255, 0.05)',
        padding: '15px',
        borderRadius: '10px',
        border: '1px solid rgba(0, 212, 255, 0.2)'
      }}>
        <div style={{ fontSize: '1.1rem', marginBottom: '5px' }}>
          ✅ <span style={{ color: '#00FF88' }}>React Enhanced Dashboard Active</span> ✅
        </div>
        <div style={{ fontSize: '0.9rem' }}>
          🚀 OrphiChain Binary Tree Network | Selected Package: <span style={{ color: '#00D4FF', fontWeight: 'bold' }}>{selectedPackage}</span>
        </div>
      </div>
    </div>
  );
}

// Check if the root element exists
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found! Creating one...');
  const newRoot = document.createElement('div');
  newRoot.id = 'root';
  document.body.appendChild(newRoot);
  console.log('Created #root element.');
} else {
  console.log('#root element found.');
}

console.log('About to render OrphiDashboard...');

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <SimpleOrphiDashboard />
    </React.StrictMode>,
  );
  console.log('OrphiDashboard rendered successfully!');
} catch (error) {
  console.error('Error rendering OrphiDashboard:', error);
}
