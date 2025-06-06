#!/usr/bin/env node

/**
 * OrphiCrowdFund Production Readiness Check
 * Comprehensive validation script for production deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ProductionReadinessChecker {
  constructor() {
    this.results = {
      frontend: { score: 0, max: 100, issues: [] },
      userExperience: { score: 0, max: 100, issues: [] },
      performance: { score: 0, max: 100, issues: [] },
      testing: { score: 0, max: 100, issues: [] },
      overall: { score: 0, max: 100, status: 'Unknown' }
    };
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    console.log(`${colors[type]}${message}${colors.reset}`);
  }

  checkFileExists(filePath) {
    return fs.existsSync(path.join(process.cwd(), filePath));
  }

  checkFrontendIntegration() {
    this.log('\n🎨 Checking Frontend Integration...', 'info');
    let score = 0;

    // Check React setup
    if (this.checkFileExists('src/App.jsx')) {
      score += 15;
      this.log('✅ React App.jsx exists', 'success');
    } else {
      this.results.frontend.issues.push('Missing React App.jsx');
    }

    // Check production components
    const components = [
      'src/components/PushNotificationSystem.jsx',
      'src/components/RealTimeUpdateManager.jsx',
      'src/components/EnhancedErrorFeedback.jsx',
      'src/components/SmartInputValidation.jsx'
    ];

    components.forEach(component => {
      if (this.checkFileExists(component)) {
        score += 15;
        this.log(`✅ ${component.split('/').pop()} ready`, 'success');
      } else {
        this.results.frontend.issues.push(`Missing ${component}`);
      }
    });

    // Check package.json dependencies
    if (this.checkFileExists('package.json')) {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const reactVersion = pkg.dependencies?.react || pkg.devDependencies?.react;
      if (reactVersion && reactVersion.includes('19')) {
        score += 10;
        this.log('✅ React 19 configured', 'success');
      }
      
      if (pkg.dependencies?.['socket.io-client']) {
        score += 5;
        this.log('✅ Socket.IO client ready', 'success');
      }
    }

    // Check Vite configuration
    if (this.checkFileExists('vite.config.js')) {
      score += 5;
      this.log('✅ Vite configuration present', 'success');
    }

    this.results.frontend.score = Math.min(score, 100);
    this.log(`Frontend Integration Score: ${this.results.frontend.score}/100`, 
             score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error');
  }

  checkUserExperience() {
    this.log('\n📱 Checking User Experience...', 'info');
    let score = 0;

    // Check CSS files for mobile responsiveness
    const cssFiles = [
      'src/components/PushNotificationSystem.css',
      'src/components/EnhancedErrorFeedback.css',
      'src/components/SmartInputValidation.css',
      'docs/components/OrphiDashboard.css'
    ];

    cssFiles.forEach(cssFile => {
      if (this.checkFileExists(cssFile)) {
        score += 10;
        this.log(`✅ ${cssFile.split('/').pop()} styling ready`, 'success');
        
        // Check for mobile responsiveness indicators
        try {
          const content = fs.readFileSync(cssFile, 'utf8');
          if (content.includes('@media') && content.includes('max-width')) {
            score += 5;
            this.log(`✅ ${cssFile.split('/').pop()} has responsive design`, 'success');
          }
          if (content.includes('safe-area-inset')) {
            score += 5;
            this.log(`✅ ${cssFile.split('/').pop()} has iOS safe area support`, 'success');
          }
        } catch (e) {
          // File not readable, skip responsive check
        }
      }
    });

    // Check index.html for viewport and accessibility
    if (this.checkFileExists('index.html')) {
      const html = fs.readFileSync('index.html', 'utf8');
      if (html.includes('viewport')) {
        score += 10;
        this.log('✅ Viewport meta tag configured', 'success');
      }
      if (html.includes('lang=')) {
        score += 5;
        this.log('✅ Language attribute set', 'success');
      }
    }

    // Check for accessibility features in React components
    if (this.checkFileExists('src/App.jsx')) {
      const app = fs.readFileSync('src/App.jsx', 'utf8');
      if (app.includes('aria-') || app.includes('role=')) {
        score += 10;
        this.log('✅ Accessibility attributes found', 'success');
      }
      if (app.includes('onKeyPress') || app.includes('onKeyDown')) {
        score += 5;
        this.log('✅ Keyboard navigation support detected', 'success');
      }
    }

    this.results.userExperience.score = Math.min(score, 100);
    this.log(`User Experience Score: ${this.results.userExperience.score}/100`, 
             score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error');
  }

  checkPerformance() {
    this.log('\n⚡ Checking Performance...', 'info');
    let score = 0;

    // Check for lazy loading implementation
    if (this.checkFileExists('src/App.jsx')) {
      const app = fs.readFileSync('src/App.jsx', 'utf8');
      if (app.includes('lazy(') && app.includes('Suspense')) {
        score += 25;
        this.log('✅ Lazy loading implemented', 'success');
      }
      if (app.includes('useEffect') && app.includes('useState')) {
        score += 15;
        this.log('✅ Modern React hooks used', 'success');
      }
      if (app.includes('useCallback') || app.includes('useMemo')) {
        score += 10;
        this.log('✅ Performance optimization hooks detected', 'success');
      }
    }

    // Check bundle optimization
    if (this.checkFileExists('vite.config.js')) {
      score += 10;
      this.log('✅ Vite bundler configured', 'success');
    }

    // Check for unnecessary dependencies
    if (this.checkFileExists('package.json')) {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const totalDeps = Object.keys(pkg.dependencies || {}).length + 
                       Object.keys(pkg.devDependencies || {}).length;
      
      if (totalDeps < 50) {
        score += 15;
        this.log('✅ Lean dependency footprint', 'success');
      } else if (totalDeps < 80) {
        score += 10;
        this.log('✅ Reasonable dependency count', 'success');
      }
    }

    // Check for error boundaries
    const componentFiles = fs.readdirSync('src/components/', { withFileTypes: true })
      .filter(dirent => dirent.isFile() && dirent.name.endsWith('.jsx'))
      .map(dirent => dirent.name);

    componentFiles.forEach(file => {
      try {
        const content = fs.readFileSync(`src/components/${file}`, 'utf8');
        if (content.includes('componentDidCatch') || content.includes('ErrorBoundary')) {
          score += 5;
          this.log(`✅ Error boundary found in ${file}`, 'success');
        }
      } catch (e) {
        // Skip unreadable files
      }
    });

    // Check for memory leak prevention
    if (this.checkFileExists('src/App.jsx')) {
      const app = fs.readFileSync('src/App.jsx', 'utf8');
      if (app.includes('useEffect') && app.includes('return () =>')) {
        score += 15;
        this.log('✅ Cleanup functions implemented', 'success');
      }
    }

    this.results.performance.score = Math.min(score, 100);
    this.log(`Performance Score: ${this.results.performance.score}/100`, 
             score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error');
  }

  checkTesting() {
    this.log('\n🧪 Checking Testing Framework...', 'info');
    let score = 0;

    // Check testing framework files
    const testFiles = [
      'src/setupTests.js',
      'cypress.config.js',
      'cypress/e2e/smoke.cy.js'
    ];

    testFiles.forEach(testFile => {
      if (this.checkFileExists(testFile)) {
        score += 20;
        this.log(`✅ ${testFile} configured`, 'success');
      } else {
        this.results.testing.issues.push(`Missing ${testFile}`);
      }
    });

    // Check package.json for testing dependencies
    if (this.checkFileExists('package.json')) {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const testingDeps = [
        '@testing-library/react',
        '@testing-library/jest-dom',
        'cypress'
      ];

      testingDeps.forEach(dep => {
        if (pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]) {
          score += 10;
          this.log(`✅ ${dep} dependency installed`, 'success');
        }
      });
    }

    // Check for test scripts
    if (this.checkFileExists('package.json')) {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (pkg.scripts?.test) {
        score += 10;
        this.log('✅ Test script configured', 'success');
      }
    }

    this.results.testing.score = Math.min(score, 100);
    this.log(`Testing Score: ${this.results.testing.score}/100`, 
             score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error');
  }

  calculateOverallScore() {
    const weights = {
      frontend: 0.3,
      userExperience: 0.3,
      performance: 0.25,
      testing: 0.15
    };

    this.results.overall.score = Math.round(
      this.results.frontend.score * weights.frontend +
      this.results.userExperience.score * weights.userExperience +
      this.results.performance.score * weights.performance +
      this.results.testing.score * weights.testing
    );

    if (this.results.overall.score >= 90) {
      this.results.overall.status = 'Production Ready';
    } else if (this.results.overall.score >= 80) {
      this.results.overall.status = 'Near Production Ready';
    } else if (this.results.overall.score >= 70) {
      this.results.overall.status = 'Requires Minor Work';
    } else {
      this.results.overall.status = 'Requires Significant Work';
    }
  }

  generateReport() {
    this.log('\n📊 PRODUCTION READINESS REPORT', 'info');
    this.log('='.repeat(50), 'info');

    Object.entries(this.results).forEach(([category, result]) => {
      if (category === 'overall') return;
      
      const percentage = ((result.score / result.max) * 100).toFixed(1);
      const status = result.score >= 80 ? 'success' : result.score >= 60 ? 'warning' : 'error';
      
      this.log(`${category.toUpperCase()}: ${result.score}/${result.max} (${percentage}%)`, status);
      
      if (result.issues.length > 0) {
        result.issues.forEach(issue => {
          this.log(`  ⚠️  ${issue}`, 'warning');
        });
      }
    });

    this.log('\n🎯 OVERALL ASSESSMENT', 'info');
    this.log('-'.repeat(30), 'info');
    
    const overallStatus = this.results.overall.score >= 90 ? 'success' : 
                         this.results.overall.score >= 80 ? 'warning' : 'error';
    
    this.log(`Overall Score: ${this.results.overall.score}/100`, overallStatus);
    this.log(`Status: ${this.results.overall.status}`, overallStatus);

    if (this.results.overall.score >= 90) {
      this.log('\n🚀 CONGRATULATIONS! Your application is ready for production deployment!', 'success');
    } else if (this.results.overall.score >= 80) {
      this.log('\n✨ Almost there! A few minor improvements will get you to production ready.', 'warning');
    } else {
      this.log('\n🔧 Some work needed before production deployment.', 'error');
    }

    return this.results;
  }

  async run() {
    this.log('🔍 Starting Production Readiness Check for OrphiCrowdFund...', 'info');
    
    this.checkFrontendIntegration();
    this.checkUserExperience();
    this.checkPerformance();
    this.checkTesting();
    this.calculateOverallScore();
    
    return this.generateReport();
  }
}

// Run the checker
if (require.main === module) {
  const checker = new ProductionReadinessChecker();
  checker.run().then(results => {
    process.exit(results.overall.score >= 80 ? 0 : 1);
  }).catch(error => {
    console.error('Error running production readiness check:', error);
    process.exit(1);
  });
}

module.exports = ProductionReadinessChecker;
