import React from 'react';

const FallbackComponent = () => {
  return (
    <div style={{
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '800px',
      margin: '0 auto',
      textAlign: 'center'
    }}>
      <h1 style={{ color: '#7B2CBF' }}>OrphiChain Dashboard</h1>
      <p>If you're seeing this, the main dashboard components may have failed to load.</p>
      
      <div style={{
        background: '#f5f5f5',
        padding: '20px',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h2>Troubleshooting Steps:</h2>
        <ol style={{ textAlign: 'left' }}>
          <li>Check the browser console for errors (F12 or right-click → Inspect → Console)</li>
          <li>Verify that all component files exist in the /src directory</li>
          <li>Check for any missing dependencies in package.json</li>
          <li>Try clearing the browser cache</li>
        </ol>
      </div>
      
      <button 
        onClick={() => window.location.reload()}
        style={{
          background: '#00D4FF',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '4px',
          marginTop: '20px',
          cursor: 'pointer'
        }}
      >
        Reload Page
      </button>
    </div>
  );
};

export default FallbackComponent;
