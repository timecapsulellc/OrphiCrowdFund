import React, { useState, Suspense, memo, useCallback } from 'react'
import './App.css'
import ErrorBoundary from './components/ErrorBoundary'
import FallbackComponent from './FallbackComponent'

// Import all components directly
import OrphiChainLogoDemo from './OrphiChainLogoDemo'
import OrphiDashboard from './OrphiDashboard'
import TeamAnalyticsDashboard from './TeamAnalyticsDashboard'
import GenealogyTreeDemo from './GenealogyTreeDemo'
import NetworkVisualization from './NetworkVisualization'
import MatrixDashboard from './MatrixDashboard'

function App() {
  const tabs = [
    { id: 'logo', label: 'Logo Demo' },
    { id: 'dashboard', label: 'Orphi Dashboard' },
    { id: 'analytics', label: 'Team Analytics' },
    { id: 'genealogy', label: 'Genealogy Tree' },
    { id: 'network', label: 'Network Visualization' },
    { id: 'matrix', label: 'Matrix Dashboard' }
  ]
  const [activeTab, setActiveTab] = useState('logo')

  // Optimize tab change handler with useCallback
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId)
  }, [])

  const renderContent = () => {
    // Loading component for Suspense fallback
    const LoadingFallback = () => (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading component...</p>
      </div>
    );

    switch(activeTab) {
      case 'logo': return (
        <ErrorBoundary>
          <OrphiChainLogoDemo />
        </ErrorBoundary>
      )
      case 'dashboard': return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <OrphiDashboard demoMode={true} />
          </Suspense>
        </ErrorBoundary>
      )
      case 'analytics': return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <TeamAnalyticsDashboard demoMode={true} />
          </Suspense>
        </ErrorBoundary>
      )
      case 'genealogy': return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <GenealogyTreeDemo demoMode={true} />
          </Suspense>
        </ErrorBoundary>
      )
      case 'network': return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <NetworkVisualization demoMode={true} />
          </Suspense>
        </ErrorBoundary>
      )
      case 'matrix': return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <MatrixDashboard demoMode={true} />
          </Suspense>
        </ErrorBoundary>
      )
      default: return null
    }
  }

  return (
    <div className="app">
      <ErrorBoundary fallback={<FallbackComponent />}>
        <header className="app-header">
          <div className="header-content">
            <h1>OrphiChain Dashboard Suite</h1>
            <p>Interactive React Components Demo</p>
          </div>
        </header>
        <nav className="app-navigation">
          <div className="nav-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
        <main className="app-main">
          <div className="component-container">
            {renderContent()}
          </div>
        </main>
        <footer className="app-footer">
          <div className="footer-content">
            <span>&copy; 2025 OrphiChain</span>
          </div>
        </footer>
      </ErrorBoundary>
    </div>
  )
}

export default memo(App)
