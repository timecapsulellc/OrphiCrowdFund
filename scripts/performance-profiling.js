#!/usr/bin/env node

/**
 * OrphiChain Dashboard Performance Profiling Script
 * 
 * This script analyzes the performance of the OrphiChain Dashboard components
 * and provides recommendations for optimization.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting OrphiChain Dashboard Performance Analysis...');

// Component size analysis
function analyzeComponentSizes() {
  console.log('\n📏 COMPONENT SIZE ANALYSIS');
  console.log('=========================');
  
  const componentsDir = path.join(__dirname, '..', 'src');
  const results = [];
  
  // Get all .jsx files
  const jsxFiles = fs.readdirSync(componentsDir)
    .filter(file => file.endsWith('.jsx'))
    .map(file => path.join(componentsDir, file));
  
  // Analyze each component
  jsxFiles.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    const size = content.length;
    const fileName = path.basename(filePath);
    
    // Count imports
    const importCount = (content.match(/import /g) || []).length;
    
    // Count useState hooks
    const useStateCount = (content.match(/useState\(/g) || []).length;
    
    // Count useEffect hooks
    const useEffectCount = (content.match(/useEffect\(/g) || []).length;
    
    results.push({
      name: fileName,
      size,
      importCount,
      useStateCount,
      useEffectCount
    });
  });
  
  // Sort by size (descending)
  results.sort((a, b) => b.size - a.size);
  
  // Display results
  results.forEach(component => {
    console.log(`\n${component.name}`);
    console.log(`  Size: ${(component.size / 1024).toFixed(2)} KB`);
    console.log(`  Imports: ${component.importCount}`);
    console.log(`  State Hooks: ${component.useStateCount}`);
    console.log(`  Effect Hooks: ${component.useEffectCount}`);
    
    // Recommendations
    if (component.size > 100000) {
      console.log('  ⚠️  RECOMMENDATION: This component is very large. Consider breaking it into smaller components.');
    } else if (component.size > 50000) {
      console.log('  ⚠️  RECOMMENDATION: This component is large. Review for potential code splitting opportunities.');
    }
    
    if (component.useEffectCount > 5) {
      console.log('  ⚠️  RECOMMENDATION: High number of useEffect hooks. Review for potential side effects that could impact performance.');
    }
  });
}

// Build time analysis
function analyzeBuildTime() {
  console.log('\n⏱️  BUILD TIME ANALYSIS');
  console.log('=====================');
  
  try {
    console.log('Running build with timing...');
    const startTime = Date.now();
    execSync('npm run build', { stdio: 'pipe' });
    const endTime = Date.now();
    const buildTime = (endTime - startTime) / 1000;
    
    console.log(`\nTotal build time: ${buildTime.toFixed(2)} seconds`);
    
    if (buildTime > 60) {
      console.log('⚠️  RECOMMENDATION: Build time is over 1 minute. Review for performance optimizations.');
    } else if (buildTime > 30) {
      console.log('⚠️  RECOMMENDATION: Build time is over 30 seconds. Consider optimization if building frequently.');
    } else {
      console.log('✅ Build time is acceptable.');
    }
  } catch (error) {
    console.error('❌ Build failed during performance analysis:', error.message);
  }
}

// CSS Analysis
function analyzeCss() {
  console.log('\n🎨 CSS ANALYSIS');
  console.log('=============');
  
  const cssFiles = [
    path.join(__dirname, '..', 'src', 'App.css'),
    path.join(__dirname, '..', 'src', 'OrphiChain.css')
  ];
  
  cssFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const fileName = path.basename(filePath);
      const size = content.length;
      
      // Count media queries (for responsive design)
      const mediaQueryCount = (content.match(/@media/g) || []).length;
      
      // Count animations
      const animationCount = (content.match(/@keyframes/g) || []).length;
      
      console.log(`\n${fileName}`);
      console.log(`  Size: ${(size / 1024).toFixed(2)} KB`);
      console.log(`  Media Queries: ${mediaQueryCount}`);
      console.log(`  Animations: ${animationCount}`);
      
      if (mediaQueryCount === 0) {
        console.log('  ⚠️  RECOMMENDATION: No media queries found. Add responsive design support.');
      } else {
        console.log('  ✅ Has responsive design support.');
      }
      
      if (size > 50000) {
        console.log('  ⚠️  RECOMMENDATION: CSS file is large. Consider splitting or optimizing.');
      }
    }
  });
}

// Run all analyses
console.log('Running complete performance analysis...');
analyzeComponentSizes();
analyzeCss();
analyzeBuildTime();

console.log('\n✨ Performance analysis completed!');
console.log('Review the recommendations above to optimize the dashboard components.');
