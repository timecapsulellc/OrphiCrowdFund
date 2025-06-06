import React, { useState } from 'react';
import MinimalTest from './MinimalTest';

const TestApp = () => {
  const [showTest, setShowTest] = useState(true);

  if (showTest) {
    return <MinimalTest />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '500px'
      }}>
        <h1 style={{ color: '#7B2CBF', marginBottom: '20px' }}>OrphiChain Dashboard</h1>
        <p style={{ fontSize: '18px', marginBottom: '30px' }}>React is working! 🎉</p>
        
        <button 
          onClick={() => setShowTest(true)}
          style={{
            background: '#00D4FF',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Show Test Component
        </button>
        
        <button 
          onClick={() => window.location.reload()}
          style={{
            background: '#7B2CBF',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Reload Page
        </button>
      </div>
    </div>
  );
};

export default TestApp
