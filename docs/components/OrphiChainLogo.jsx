import React, { useState, useEffect } from 'react';
import './OrphiChain.css';

/**
 * OrphiChain Logo Component
 * 
 * A reusable SVG logo component for the OrphiChain brand that supports
 * different sizes, variants, and animation options.
 * 
 * @param {Object} props
 * @param {string} [props.size='medium'] - Logo size (tiny, small, medium, large)
 * @param {string} [props.variant='standard'] - Logo variant (standard, hexagonal, orbital)
 * @param {boolean} [props.autoRotate=false] - Whether to animate the logo with rotation
 * @param {string} [props.backgroundColor='transparent'] - Background color behind the logo
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
    small: { width: '80px', height: '80px' },
    medium: { width: '120px', height: '120px' },
    large: { width: '200px', height: '200px' }
  };

  // Handle auto-rotation animation
  useEffect(() => {
    if (!autoRotate) return;
    
    const interval = setInterval(() => {
      setRotation(prev => (prev + 1) % 360);
    }, 50); // Rotate smoothly
    
    return () => clearInterval(interval);
  }, [autoRotate]);

  // Determine background class based on backgroundColor prop
  const getBgClass = () => {
    if (backgroundColor === 'transparent') return 'logo-transparent-bg';
    if (backgroundColor === 'dark') return 'logo-dark-bg';
    if (backgroundColor === 'light') return 'logo-light-bg';
    return 'logo-transparent-bg';
  };

  // The SVG logo with the chosen variant
  const renderLogo = () => {
    // Common SVG definitions
    const svgDefs = (
      <defs>
        <linearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00d4ff" />
          <stop offset="50%" stopColor="#7b2cbf" />
          <stop offset="100%" stopColor="#ff6b35" />
        </linearGradient>
        <linearGradient id="darkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a1a2e" />
          <stop offset="100%" stopColor="#16213e" />
        </linearGradient>
      </defs>
    );

    // Standard/hexagonal variant - the geometric diamond shape
    if (variant === 'standard' || variant === 'hexagonal') {
      return (
        <svg 
          width="100%" 
          height="100%" 
          viewBox="0 0 400 400" 
          xmlns="http://www.w3.org/2000/svg"
          style={{ 
            transform: autoRotate ? `rotate(${rotation}deg)` : 'none',
            transition: 'transform 0.05s linear'
          }}
          aria-labelledby="orpihiChainLogoTitle orpihiChainLogoDesc"
          role="img"
        >
          <title id="orpihiChainLogoTitle">OrphiChain Logo</title>
          <desc id="orpihiChainLogoDesc">A geometric representation of the OrphiChain brand.</desc>
          {svgDefs}
          <g transform="translate(200, 200)">
            <path d="M -80,-20 L -40,-80 L 0,-60 Z" fill="url(#mainGradient)" />
            <path d="M -80,-20 L 0,-60 L -30,-10 Z" fill="url(#darkGradient)" opacity="0.7" />
            <path d="M 40,-80 L 80,-20 L 60,0 Z" fill="url(#mainGradient)" />
            <path d="M 40,-80 L 60,0 L 0,-60 Z" fill="url(#darkGradient)" opacity="0.7" />
            <path d="M 80,20 L 40,80 L 0,60 Z" fill="url(#mainGradient)" />
            <path d="M 80,20 L 0,60 L 30,10 Z" fill="url(#darkGradient)" opacity="0.7" />
            <path d="M -40,80 L -80,20 L -60,0 Z" fill="url(#mainGradient)" />
            <path d="M -40,80 L -60,0 L 0,60 Z" fill="url(#darkGradient)" opacity="0.7" />
            <path d="M -30,-10 L 0,-60 L 30,10 L 0,60 Z" fill="#16213e" />
          </g>
        </svg>
      );
    }

    // Orbital variant - circular with connecting nodes (fallback)
    return (
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 400 400" 
        xmlns="http://www.w3.org/2000/svg"
        aria-labelledby="orpihiChainLogoTitle orpihiChainLogoDesc"
        role="img"
      >
        <title id="orpihiChainLogoTitle">OrphiChain Logo</title>
        <desc id="orpihiChainLogoDesc">A circular representation of the OrphiChain brand with connecting nodes.</desc>
        {svgDefs}
        <g transform="translate(200, 200)">
          <circle cx="0" cy="0" r="100" fill="none" stroke="url(#mainGradient)" strokeWidth="4" />
          <circle cx="0" cy="0" r="70" fill="none" stroke="url(#darkGradient)" strokeWidth="3" opacity="0.7" />
          <circle cx="0" cy="0" r="40" fill="none" stroke="url(#mainGradient)" strokeWidth="2" />
          
          <circle cx="85" cy="50" r="12" fill="url(#mainGradient)" />
          <circle cx="-85" cy="50" r="12" fill="url(#mainGradient)" />
          <circle cx="0" cy="-100" r="12" fill="url(#mainGradient)" />
          
          <path d="M 0,-100 L 85,50 L -85,50 Z" fill="none" stroke="url(#darkGradient)" strokeWidth="2" />
          <circle cx="0" cy="0" r="18" fill="url(#darkGradient)" />
        </g>
      </svg>
    );
  };

  return (
    <div 
      className={`orphi-logo ${getBgClass()}`}
      style={{
        width: sizeConfig[size].width,
        height: sizeConfig[size].height
      }}
      aria-label="OrphiChain logo"
      role="img"
    >
      {renderLogo()}
    </div>
  );
};

export default OrphiChainLogo;
