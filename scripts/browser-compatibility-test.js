#!/usr/bin/env node

/**
 * OrphiChain Dashboard Browser Compatibility Test
 * 
 * This script injects browser compatibility testing code into the index.html
 * to help verify that the application works across different browsers.
 */

const fs = require('fs');
const path = require('path');

console.log('🌐 Setting up browser compatibility testing...');

// Path to the built index.html
const distDir = path.join(__dirname, '..', 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');

if (!fs.existsSync(distDir) || !fs.existsSync(indexHtmlPath)) {
  console.error('❌ Error: dist directory or index.html not found. Run a build first with npm run build');
  process.exit(1);
}

// Read the index.html content
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// Browser compatibility detection script
const compatibilityScript = `
<script>
  // Browser compatibility testing
  (function() {
    const browserInfo = {
      name: '',
      version: '',
      compatible: true,
      issues: []
    };
    
    // Detect browser
    const userAgent = navigator.userAgent;
    
    if (userAgent.indexOf("Chrome") > -1) {
      browserInfo.name = "Chrome";
      browserInfo.version = userAgent.match(/Chrome\\/(\\d+)/)[1];
      
      if (parseInt(browserInfo.version) < 90) {
        browserInfo.compatible = false;
        browserInfo.issues.push("Chrome version too old (requires 90+)");
      }
    } 
    else if (userAgent.indexOf("Firefox") > -1) {
      browserInfo.name = "Firefox";
      browserInfo.version = userAgent.match(/Firefox\\/(\\d+)/)[1];
      
      if (parseInt(browserInfo.version) < 85) {
        browserInfo.compatible = false;
        browserInfo.issues.push("Firefox version too old (requires 85+)");
      }
    }
    else if (userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") === -1) {
      browserInfo.name = "Safari";
      
      // Safari version detection is more complex
      const versionMatch = userAgent.match(/Version\\/(\\d+)/);
      browserInfo.version = versionMatch ? versionMatch[1] : "Unknown";
      
      if (parseInt(browserInfo.version) < 14) {
        browserInfo.compatible = false;
        browserInfo.issues.push("Safari version too old (requires 14+)");
      }
    }
    else if (userAgent.indexOf("Edg") > -1) {
      browserInfo.name = "Edge";
      browserInfo.version = userAgent.match(/Edg\\/(\\d+)/)[1];
      
      if (parseInt(browserInfo.version) < 90) {
        browserInfo.compatible = false;
        browserInfo.issues.push("Edge version too old (requires 90+)");
      }
    }
    else {
      browserInfo.name = "Unknown";
      browserInfo.compatible = false;
      browserInfo.issues.push("Browser not identified as Chrome, Firefox, Safari, or Edge");
    }
    
    // Test for required features
    const requiredFeatures = [
      { name: "CSS Grid", test: () => window.CSS && CSS.supports && CSS.supports('display', 'grid') },
      { name: "Flexbox", test: () => window.CSS && CSS.supports && CSS.supports('display', 'flex') },
      { name: "Fetch API", test: () => typeof fetch === 'function' },
      { name: "ES6 Promises", test: () => typeof Promise === 'function' },
      { name: "CSS Variables", test: () => window.CSS && CSS.supports && CSS.supports('--test', '0') }
    ];
    
    requiredFeatures.forEach(feature => {
      try {
        if (!feature.test()) {
          browserInfo.compatible = false;
          browserInfo.issues.push(\`Missing support for \${feature.name}\`);
        }
      } catch (e) {
        browserInfo.compatible = false;
        browserInfo.issues.push(\`Error testing \${feature.name}: \${e.message}\`);
      }
    });
    
    // Display compatibility banner
    const banner = document.createElement('div');
    banner.style.position = 'fixed';
    banner.style.bottom = '0';
    banner.style.left = '0';
    banner.style.right = '0';
    banner.style.padding = '10px';
    banner.style.backgroundColor = browserInfo.compatible ? '#4CAF50' : '#F44336';
    banner.style.color = 'white';
    banner.style.textAlign = 'center';
    banner.style.zIndex = '9999';
    banner.style.fontSize = '14px';
    
    if (browserInfo.compatible) {
      banner.innerHTML = \`✅ Compatible with \${browserInfo.name} \${browserInfo.version}\`;
    } else {
      banner.innerHTML = \`⚠️ Compatibility issues detected with \${browserInfo.name} \${browserInfo.version}: \${browserInfo.issues.join(', ')}\`;
    }
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = 'Dismiss';
    closeBtn.style.marginLeft = '10px';
    closeBtn.style.padding = '3px 8px';
    closeBtn.style.background = 'white';
    closeBtn.style.color = browserInfo.compatible ? '#4CAF50' : '#F44336';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '3px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => banner.remove();
    
    banner.appendChild(closeBtn);
    
    // Add to page after a slight delay
    setTimeout(() => {
      document.body.appendChild(banner);
      
      // Also log to console
      console.log('Browser compatibility:', browserInfo);
    }, 1000);
  })();
</script>
`;

// Inject the compatibility script before the closing body tag
indexHtml = indexHtml.replace('</body>', `${compatibilityScript}\n</body>`);

// Write the modified file
fs.writeFileSync(indexHtmlPath, indexHtml);

console.log('✅ Browser compatibility testing code injected into index.html');
console.log('📋 To test browser compatibility:');
console.log('  1. Run npm run build');
console.log('  2. Run node scripts/browser-compatibility-test.js');
console.log('  3. Run npm run preview');
console.log('  4. Open the preview URL in different browsers');
console.log('  5. Check for the compatibility banner at the bottom of the page');
