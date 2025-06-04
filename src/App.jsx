import React, { useState } from 'react'
import './App.css'

// Import OrphiChain components
import OrphiChainLogo from '../docs/components/OrphiChainLogo.jsx'
import OrphiChainLogoDemo from '../docs/components/OrphiChainLogoDemo.jsx'
import OrphiDashboard from '../docs/components/OrphiDashboard.jsx'
import TeamAnalyticsDashboard from '../docs/components/TeamAnalyticsDashboard.jsx'
import GenealogyTreeDemo from '../docs/components/GenealogyTreeDemo.jsx'
import NetworkVisualization from '../docs/components/NetworkVisualization.jsx'

// Import CSS files
import '../docs/components/OrphiChainLogo.css'
import '../docs/components/OrphiChain.css'
import '../docs/components/OrphiDashboard.css'
import '../docs/components/TeamAnalyticsDashboard.css'
import '../docs/components/GenealogyTreeDemo.css'
import '../docs/components/NetworkVisualization.css'

function App() {
  const [activeTab, setActiveTab] = useState('logo-demo')

  const tabs = [
    { id: 'logo-demo', label: 'Logo Demo', icon: '🎨' },
    { id: 'orphi-dashboard', label: 'Orphi Dashboard', icon: '📊' },
    { id: 'analytics', label: 'Team Analytics', icon: '📈' },
    { id: 'genealogy', label: 'Genealogy Tree', icon: '🌳' },
    { id: 'network', label: 'Network Visualization', icon: '🔗' }
  ]

  const renderActiveComponent = () => {
    // Mock user data for demo
    const mockUserAddress = '0x1234...5678';

    switch (activeTab) {
      case 'logo-demo':
        return <OrphiChainLogoDemo />
      case 'orphi-dashboard':
        return <OrphiDashboard 
          userAddress={mockUserAddress}
          demoMode={true}
        />
      case 'analytics':
        return <TeamAnalyticsDashboard 
          userAddress={mockUserAddress}
          demoMode={true}
        />
      case 'genealogy':
        return <GenealogyTreeDemo />
      case 'network':
        return <NetworkVisualization 
          userAddress={mockUserAddress}
          maxDepth={4}
          demoMode={true}
        />
      default:
        return <OrphiChainLogoDemo />
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <OrphiChainLogo size="small" variant="orbital" autoRotate={true} />
          <h1>OrphiChain Dashboard Suite</h1>
          <p>Interactive React Components Demo</p>
        </div>
      </header>

      <nav className="app-navigation">
        <div className="nav-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="app-main">
        <div className="component-container">
          {renderActiveComponent()}
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <OrphiChainLogo size="tiny" variant="chain" />
          <p>&copy; 2024 OrphiChain. Matrix-based compensation system on BSC.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
