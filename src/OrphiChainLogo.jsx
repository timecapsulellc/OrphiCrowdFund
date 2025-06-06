import React, { useState, useEffect } from 'react';
import './OrphiChain.css';

/**
 * OrphiChain Logo Component
 * Simplified version for direct rendering
 */
const OrphiChainLogo = ({ 
  size = 'medium', 
  variant = 'standard',
  autoRotate = false,
  backgroundColor = 'transparent'
}) => {
  const [rotation, setRotation] = useState(0);
  
  // Size configuration
  const sizeConfig = {
    tiny: { width: '40px', height: '40px' },
    small: { width: '60px', height: '60px' },
    medium: { width: '120px', height: '120px' },
    large: { width: '200px', height: '200px' },
    custom: { width: '100%', height: '100%' }
  };
  
  // Auto-rotation effect
  useEffect(() => {
    let animationFrame;
    
    const animate = () => {
      if (autoRotate) {
        setRotation(prev => (prev + 0.5) % 360);
      }
      animationFrame = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [autoRotate]);
  
  const { width, height } = sizeConfig[size] || sizeConfig.medium;
  
  // Return the SVG based on variant
  const renderLogo = () => {
    // Base styles for all variants
    const containerStyle = {
      width,
      height,
      position: 'relative',
      display: 'inline-block',
      backgroundColor
    };
    
    const standardLogo = (
      <div style={containerStyle} className="orphi-logo standard-logo">
        <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: `rotate(${rotation}deg)` }}>
          <circle cx="50" cy="50" r="45" stroke="#00D4FF" strokeWidth="2" />
          <path d="M50 10 L90 50 L50 90 L10 50 Z" fill="#7B2CBF" fillOpacity="0.7" />
          <circle cx="50" cy="50" r="15" fill="#FF6B35" />
          <text x="50" y="55" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">OC</text>
        </svg>
      </div>
    );
    
    const orbitalLogo = (
      <div style={containerStyle} className="orphi-logo orbital-logo">
        <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Outer orbit */}
          <circle cx="50" cy="50" r="45" stroke="#00D4FF" strokeWidth="2" style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center' }} />
          
          {/* Middle orbit */}
          <circle cx="50" cy="50" r="30" stroke="#7B2CBF" strokeWidth="1.5" style={{ transform: `rotate(${-rotation * 1.5}deg)`, transformOrigin: 'center' }} />
          
          {/* Inner orbit */}
          <circle cx="50" cy="50" r="15" stroke="#FF6B35" strokeWidth="1" style={{ transform: `rotate(${rotation * 2}deg)`, transformOrigin: 'center' }} />
          
          {/* Orbital nodes */}
          <circle cx="95" cy="50" r="4" fill="#00D4FF" />
          <circle cx="50" cy="5" r="4" fill="#00D4FF" />
          <circle cx="5" cy="50" r="4" fill="#00D4FF" />
          <circle cx="50" cy="95" r="4" fill="#00D4FF" />
          
          <circle cx="80" cy="50" r="3" fill="#7B2CBF" style={{ transform: `rotate(${rotation * 1.5}deg)`, transformOrigin: 'center' }} />
          <circle cx="50" cy="20" r="3" fill="#7B2CBF" style={{ transform: `rotate(${rotation * 1.5}deg)`, transformOrigin: 'center' }} />
          <circle cx="20" cy="50" r="3" fill="#7B2CBF" style={{ transform: `rotate(${rotation * 1.5}deg)`, transformOrigin: 'center' }} />
          <circle cx="50" cy="80" r="3" fill="#7B2CBF" style={{ transform: `rotate(${rotation * 1.5}deg)`, transformOrigin: 'center' }} />
          
          {/* Center */}
          <circle cx="50" cy="50" r="8" fill="#FF6B35" />
          <text x="50" y="53" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">OC</text>
        </svg>
      </div>
    );
    
    const hexagonalLogo = (
      <div style={containerStyle} className="orphi-logo hexagonal-logo">
        <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Hexagon */}
          <path d="M50 5 L90 25 L90 75 L50 95 L10 75 L10 25 Z" 
                stroke="#00D4FF" 
                strokeWidth="2" 
                fill="#7B2CBF" 
                fillOpacity="0.2"
                style={{ transform: `rotate(${rotation / 2}deg)`, transformOrigin: 'center' }} />
          
          {/* Inner hexagon */}
          <path d="M50 25 L70 35 L70 65 L50 75 L30 65 L30 35 Z" 
                stroke="#7B2CBF" 
                strokeWidth="1.5" 
                fill="#7B2CBF" 
                fillOpacity="0.4"
                style={{ transform: `rotate(${-rotation / 2}deg)`, transformOrigin: 'center' }} />
          
          {/* Center */}
          <circle cx="50" cy="50" r="15" fill="#FF6B35" />
          <text x="50" y="55" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">OC</text>
        </svg>
      </div>
    );
    
    switch(variant) {
      case 'orbital': return orbitalLogo;
      case 'hexagonal': return hexagonalLogo;
      default: return standardLogo;
    }
  };
  
  return renderLogo();
};

export default OrphiChainLogo;
