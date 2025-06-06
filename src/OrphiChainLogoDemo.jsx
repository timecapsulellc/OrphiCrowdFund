import React, { useState } from 'react';
import OrphiChainLogo from './OrphiChainLogo';

const OrphiChainLogoDemo = () => {
  const [logoVariant, setLogoVariant] = useState('orbital');
  const [logoSize, setLogoSize] = useState('medium');
  const [autoRotate, setAutoRotate] = useState(true);

  return (
    <div style={{ padding: '20px', textAlign: 'center', color: '#333' }}>
      <h2>OrphiChain Logo Demo</h2>
      
      {/* Animated OrphiChain Logo */}
      <div style={{ margin: '20px auto' }}>
        <OrphiChainLogo
          size={logoSize}
          variant={logoVariant}
          autoRotate={autoRotate}
        />
      </div>
      
      {/* Controls */}
      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <div>
          <label style={{ marginRight: '10px' }}>Variant:</label>
          <select 
            value={logoVariant} 
            onChange={(e) => setLogoVariant(e.target.value)}
            style={{ padding: '4px 8px' }}
          >
            <option value="standard">Standard</option>
            <option value="orbital">Orbital</option>
            <option value="hexagonal">Hexagonal</option>
          </select>
        </div>
        
        <div>
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
        
        <div>
          <label style={{ marginRight: '10px' }}>Animation:</label>
          <input 
            type="checkbox" 
            checked={autoRotate} 
            onChange={(e) => setAutoRotate(e.target.checked)}
          />
        </div>
      </div>

      {/* Logo Information */}
      <div style={{ 
        marginTop: '30px', 
        padding: '15px', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '8px',
        textAlign: 'left',
        maxWidth: '600px',
        margin: '30px auto'
      }}>
        <h4>Current Settings:</h4>
        <p><strong>Variant:</strong> {logoVariant}</p>
        <p><strong>Size:</strong> {logoSize}</p>
        <p><strong>Animation:</strong> {autoRotate ? 'On' : 'Off'}</p>
        <p><strong>Status:</strong> Ready for integration!</p>
      </div>
    </div>
  );
};

export default OrphiChainLogoDemo;
