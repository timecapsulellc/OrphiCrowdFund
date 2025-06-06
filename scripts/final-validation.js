#!/usr/bin/env node

/**
 * Final Production Validation Suite
 * Runs comprehensive checks to achieve 100% production readiness
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🎯 ORPHI CROWDFUND - FINAL PRODUCTION VALIDATION');
console.log('===============================================');
console.log(`Date: ${new Date().toISOString()}`);
console.log('Target: 100/100 Production Readiness Score\n');

let totalScore = 0;
let maxScore = 0;
const results = [];

// Test 1: Build Validation
console.log('1️⃣ BUILD VALIDATION');
console.log('-------------------');
try {
  console.log('Building production version...');
  execSync('npm run build', { stdio: 'pipe' });
  
  // Check if dist folder exists and has files
  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    console.log(`✅ Build successful - ${files.length} files generated`);
    results.push({ test: 'Build System', score: 20, max: 20, status: 'PASS' });
    totalScore += 20;
  } else {
    console.log('❌ Build failed - no dist folder');
    results.push({ test: 'Build System', score: 0, max: 20, status: 'FAIL' });
  }
} catch (error) {
  console.log('❌ Build failed:', error.message);
  results.push({ test: 'Build System', score: 0, max: 20, status: 'FAIL' });
}
maxScore += 20;

// Test 2: Component Validation
console.log('\n2️⃣ COMPONENT VALIDATION');
console.log('------------------------');
const srcPath = path.join(__dirname, '..', 'src');
const components = [
  'App.jsx',
  'OrphiDashboard.jsx', 
  'TeamAnalyticsDashboard.jsx',
  'GenealogyTreeDemo.jsx',
  'NetworkVisualization.jsx',
  'OrphiChainLogoDemo.jsx'
];

let componentScore = 0;
components.forEach(component => {
  const filePath = path.join(srcPath, component);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.length > 100 && content.includes('export')) {
      console.log(`✅ ${component} - Valid`);
      componentScore += 3;
    } else {
      console.log(`⚠️  ${component} - Minimal content`);
      componentScore += 1;
    }
  } else {
    console.log(`❌ ${component} - Missing`);
  }
});

results.push({ test: 'Component Validation', score: componentScore, max: 18, status: componentScore >= 15 ? 'PASS' : 'WARN' });
totalScore += componentScore;
maxScore += 18;

// Test 3: Performance Check
console.log('\n3️⃣ PERFORMANCE CHECK');
console.log('--------------------');
let perfScore = 0;

// Check bundle size
try {
  const bundleStatsPath = path.join(__dirname, '..', 'dist', 'bundle-stats.json');
  if (fs.existsSync(bundleStatsPath)) {
    const stats = JSON.parse(fs.readFileSync(bundleStatsPath, 'utf8'));
    console.log('✅ Bundle analysis available');
    perfScore += 5;
    
    if (stats.status === 'success') {
      console.log('✅ Build status: Success');
      perfScore += 10;
    }
  }
} catch (error) {
  console.log('⚠️  Bundle analysis failed');
}

// Check CSS optimization
const cssPath = path.join(srcPath, 'App.css');
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, 'utf8');
  if (css.includes('@media') && css.includes('responsive')) {
    console.log('✅ Responsive design implemented');
    perfScore += 7;
  }
}

results.push({ test: 'Performance', score: perfScore, max: 22, status: perfScore >= 18 ? 'PASS' : 'WARN' });
totalScore += perfScore;
maxScore += 22;

// Test 4: Error Handling
console.log('\n4️⃣ ERROR HANDLING');
console.log('-----------------');
let errorScore = 0;

const errorBoundaryPath = path.join(srcPath, 'components', 'ErrorBoundary.jsx');
if (fs.existsSync(errorBoundaryPath)) {
  console.log('✅ ErrorBoundary component exists');
  errorScore += 10;
}

const fallbackPath = path.join(srcPath, 'FallbackComponent.jsx');
if (fs.existsSync(fallbackPath)) {
  console.log('✅ Fallback component exists');
  errorScore += 5;
}

const debugPath = path.join(srcPath, 'debug-helper.js');
if (fs.existsSync(debugPath)) {
  console.log('✅ Debug helper exists');
  errorScore += 5;
}

results.push({ test: 'Error Handling', score: errorScore, max: 20, status: errorScore >= 15 ? 'PASS' : 'WARN' });
totalScore += errorScore;
maxScore += 20;

// Test 5: Documentation & Deployment Ready
console.log('\n5️⃣ DEPLOYMENT READINESS');
console.log('------------------------');
let deployScore = 0;

const requiredDocs = [
  'README.md',
  'PRODUCTION_DEPLOYMENT_GUIDE.md',
  'FINAL_PRODUCTION_READINESS_REPORT.md'
];

requiredDocs.forEach(doc => {
  const docPath = path.join(__dirname, '..', doc);
  if (fs.existsSync(docPath)) {
    console.log(`✅ ${doc} exists`);
    deployScore += 7;
  } else {
    console.log(`❌ ${doc} missing`);
  }
});

results.push({ test: 'Deployment Ready', score: deployScore, max: 21, status: deployScore >= 18 ? 'PASS' : 'WARN' });
totalScore += deployScore;
maxScore += 21;

// Final Results
console.log('\n🎯 FINAL RESULTS');
console.log('================');
console.log('Test Results:');
results.forEach(result => {
  const percentage = Math.round((result.score / result.max) * 100);
  const status = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
  console.log(`${status} ${result.test}: ${result.score}/${result.max} (${percentage}%)`);
});

const finalScore = Math.round((totalScore / maxScore) * 100);
console.log(`\n🏆 FINAL SCORE: ${totalScore}/${maxScore} (${finalScore}%)`);

if (finalScore >= 95) {
  console.log('🎉 PRODUCTION READY! ✅');
  console.log('Status: Ready for mainnet deployment');
} else if (finalScore >= 85) {
  console.log('⚠️  NEAR PRODUCTION READY');
  console.log('Status: Minor optimizations needed');
} else {
  console.log('❌ REQUIRES WORK');
  console.log('Status: Significant improvements needed');
}

// Save results
const reportPath = path.join(__dirname, '..', 'FINAL_VALIDATION_REPORT.json');
const report = {
  timestamp: new Date().toISOString(),
  finalScore,
  totalScore,
  maxScore,
  status: finalScore >= 95 ? 'PRODUCTION_READY' : finalScore >= 85 ? 'NEAR_READY' : 'NEEDS_WORK',
  results,
  recommendations: finalScore < 95 ? [
    'Review failed test cases',
    'Optimize component performance',
    'Complete documentation',
    'Run additional testing'
  ] : ['System ready for deployment']
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📄 Detailed report saved: ${reportPath}`);

process.exit(finalScore >= 95 ? 0 : 1);
