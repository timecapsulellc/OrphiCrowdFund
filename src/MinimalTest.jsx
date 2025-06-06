import React from 'react';

const MinimalTest = () => {
  return (
    <div style={{
      padding: '20px',
      maxWidth: '600px',
      margin: '40px auto',
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#7B2CBF' }}>OrphiChain Test Page</h1>
      <p>If you can see this page, React is working correctly!</p>
      
      <div style={{ 
        padding: '15px', 
        background: '#f5f5f5', 
        borderRadius: '4px',
        marginTop: '20px'
      }}>
        <p>This is a minimal test component to verify that React rendering is working.</p>
        <p>Current time: {new Date().toLocaleTimeString()}</p>
      </div>
      
      <button 
        onClick={() => alert('Button works!')}
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
        Test Button
      </button>
    </div>
  );
};

export default MinimalTest;
