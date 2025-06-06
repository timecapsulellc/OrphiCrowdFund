// OrphiChainLogoDemo.jsx - Demo component for OrphiChain animated logo
import React, { useState } from 'react';
import OrphiChainLogo from './OrphiChainLogo';

const OrphiChainLogoDemo = () => {
  const [logoVariant, setLogoVariant] = useState('orbital');
  const [logoSize, setLogoSize] = useState('medium');

  const handleVariantChange = (variant) => {
    setLogoVariant(variant);
    console.log('Logo variant changed to:', variant);
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>OrphiChain Logo Demo</h2>
      
      {/* Animated OrphiChain Logo */}
      <div style={{ margin: '20px auto' }}>
        <OrphiChainLogo
          size={logoSize}
          variant={logoVariant}
          autoRotate={true}
          backgroundColor="transparent"
        />
      </div>
      
      {/* Size Controls */}
      <div style={{ marginTop: '20px' }}>
        <h3>Size Control</h3>
        <div style={{ marginTop: '15px' }}>
          <label style={{ marginRight: '10px' }}>Size:</label>
          <select 
            value={logoSize} 
            onChange={(e) => setLogoSize(e.target.value)}
            style={{ padding: '4px 8px' }}
          >
            <option value="small">Small (60px)</option>
            <option value="medium">Medium (120px)</option>
            <option value="large">Large (200px)</option>
          </select>
        </div>
      </div>

      {/* Logo Information */}
      <div style={{ 
        marginTop: '30px', 
        padding: '15px', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '8px',
        textAlign: 'left'
      }}>
        <h4>Current Settings:</h4>
        <p><strong>Variant:</strong> {logoVariant}</p>
        <p><strong>Size:</strong> {logoSize}</p>
        <p><strong>Features:</strong></p>
        <ul>
          <li>Orbital: Animated concentric orbits with nodes</li>
          <li>Hexagonal: Animated hexagonal network grid</li>
          <li>Chain: Animated connected chain links</li>
          <li>Auto-rotation: Cycles through variants automatically</li>
        </ul>
        <p><strong>Status:</strong> Animated logo component is active!</p>
      </div>
    </div>
  );
};

export default OrphiChainLogoDemo;