#!/bin/bash

# OrphiCrowdFund Dashboard Server Startup Script
# This script starts a local development server to render the dashboard

echo "🚀 Starting OrphiCrowdFund Dashboard..."
echo "📁 Working directory: $(pwd)"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies if missing
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --legacy-peer-deps
fi

echo "🔧 Building the project..."
npm run build

# Change into build output directory
cd dist || { echo "❌ dist directory not found. Build may have failed."; exit 1; }

echo "🌐 Starting static server on port 3000 serving dist..."
echo "📱 Dashboard will open automatically in your browser"
echo "🔗 Manual URL: http://localhost:3000"

# Serve from dist directory
if command -v python3 &> /dev/null; then
    echo "Using Python 3 http.server..."
    python3 -m http.server 3000
elif command -v python &> /dev/null; then
    echo "Using Python 2 SimpleHTTPServer..."
    python -m SimpleHTTPServer 3000
elif command -v npx &> /dev/null; then
    echo "Using npx serve..."
    npx serve -s . -l 3000
else
    echo "❌ No suitable server found. Please install Python or Node.js"
    exit 1
fi
