import React from 'react'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>OrphiChain Dashboard Suite</h1>
        <p>Loading...</p>
      </header>
      <main>
        <div style={{ padding: '2rem', color: 'white', textAlign: 'center' }}>
          <h2>🚀 OrphiCrowdFund UI is working!</h2>
          <p>React is successfully rendering.</p>
          <button style={{ padding: '1rem 2rem', margin: '1rem', backgroundColor: '#00D4FF', color: 'black', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Test Button
          </button>
        </div>
      </main>
    </div>
  )
}

export default App
