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

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🔧 Building the project..."
npm run build

echo "🌐 Starting development server on port 3000..."
echo "📱 Dashboard will open automatically in your browser"
echo "🔗 Manual URL: http://localhost:3000"

# Try multiple server options
if command -v python3 &> /dev/null; then
    echo "Using Python 3 server..."
    python3 -m http.server 3000
elif command -v python &> /dev/null; then
    echo "Using Python 2 server..."
    python -m SimpleHTTPServer 3000
elif command -v npx &> /dev/null; then
    echo "Using npx serve..."
    npx serve -s . -l 3000
else
    echo "❌ No suitable server found. Please install Python or Node.js"
    exit 1
fi
