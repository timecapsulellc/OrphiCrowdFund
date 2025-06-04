import React from 'react'
import './App.css'

// Simple test component first
const TestComponent = () => {
  return (
    <div style={{ color: 'white', padding: '2rem', textAlign: 'center' }}>
      <h1>OrphiChain Test</h1>
      <p>If you can see this, React is working!</p>
      <div style={{ 
        width: '100px', 
        height: '100px', 
        backgroundColor: 'white', 
        margin: '20px auto',
        borderRadius: '50%'
      }}>
        Basic Circle
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="app">
      <TestComponent />
    </div>
  )
}

export default App
