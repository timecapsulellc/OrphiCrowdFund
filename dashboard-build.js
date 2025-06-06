#!/usr/bin/env node

/**
 * OrphiChain Dashboard Build Script
 * 
 * This script prepares the OrphiChain Dashboard Suite for production deployment
 * by ensuring all components, CSS, and dependencies are properly bundled.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting OrphiChain Dashboard production build...');

try {
  // Ensure components directory is copied to src for proper imports
  const componentsDir = path.join(__dirname, 'docs', 'components');
  const srcComponentsDir = path.join(__dirname, 'src', 'components');

  // Create src/components directory if it doesn't exist
  if (!fs.existsSync(srcComponentsDir)) {
    console.log('📁 Creating src/components directory...');
    fs.mkdirSync(srcComponentsDir, { recursive: true });
  }

  // Copy all component files
  console.log('📋 Copying component files to src/components...');
  fs.readdirSync(componentsDir).forEach(file => {
    const srcFile = path.join(componentsDir, file);
    const destFile = path.join(srcComponentsDir, file);
    
    // Skip directories (we'll handle utils separately)
    if (fs.statSync(srcFile).isDirectory()) {
      return;
    }
    
    fs.copyFileSync(srcFile, destFile);
    console.log(`   ✅ Copied ${file}`);
  });

  // Copy utils directory if it exists
  const utilsDir = path.join(componentsDir, 'utils');
  const srcUtilsDir = path.join(srcComponentsDir, 'utils');
  if (fs.existsSync(utilsDir)) {
    if (!fs.existsSync(srcUtilsDir)) {
      fs.mkdirSync(srcUtilsDir, { recursive: true });
    }
    
    fs.readdirSync(utilsDir).forEach(file => {
      const srcFile = path.join(utilsDir, file);
      const destFile = path.join(srcUtilsDir, file);
      if (!fs.statSync(srcFile).isDirectory()) {
        fs.copyFileSync(srcFile, destFile);
        console.log(`   ✅ Copied utils/${file}`);
      }
    });
  }

  // Update App.jsx to use local component imports
  console.log('🔄 Updating App.jsx with local component imports...');
  const appJsxPath = path.join(__dirname, 'src', 'App.jsx');
  let appJsxContent = fs.readFileSync(appJsxPath, 'utf8');

  // Replace ../docs/components/ with ./components/
  appJsxContent = appJsxContent.replace(/\.\.\/docs\/components\//g, './components/');
  fs.writeFileSync(appJsxPath, appJsxContent);
  
  // Add browser compatibility meta tags to index.html
  console.log('🌐 Adding browser compatibility tags to index.html...');
  const indexHtmlPath = path.join(__dirname, 'index.html');
  let indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // Check if meta tags are already present
  if (!indexHtmlContent.includes('viewport')) {
    const headEndIndex = indexHtmlContent.indexOf('</head>');
    if (headEndIndex !== -1) {
      const metaTags = `
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <!-- Browser compatibility -->
  <meta name="supported-browsers" content="chrome, firefox, safari, edge">
  <meta name="supported-versions" content="chrome>=90, firefox>=85, safari>=14, edge>=90">
`;
      indexHtmlContent = indexHtmlContent.substring(0, headEndIndex) + metaTags + indexHtmlContent.substring(headEndIndex);
      fs.writeFileSync(indexHtmlPath, indexHtmlContent);
      console.log('✅ Browser compatibility meta tags added to index.html');
    }
  }

  // Run the production build
  console.log('🏗️ Running production build...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✨ Production build completed successfully!');
    
    // Validate the build output
    console.log('🔍 Validating build output...');
    const distDir = path.join(__dirname, 'dist');
    if (!fs.existsSync(distDir)) {
      throw new Error('Build failed - dist directory not found');
    }
    
    // Check for key files in the build output
    const indexHtml = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      throw new Error('Build failed - index.html not found in dist');
    }
    
    console.log('✅ Build validation successful!');
    console.log('💡 To test the production build, run: npm run preview');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
