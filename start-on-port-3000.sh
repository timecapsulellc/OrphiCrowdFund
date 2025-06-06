#!/bin/zsh

# Enhanced script to start OrphiCrowdFund on port 3000
echo "🚀 Starting OrphiCrowdFund Dashboard on port 3000..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js to continue."
    exit 1
fi

# Navigate to project directory
cd "/Users/dadou/Orphi CrowdFund" || {
    echo "❌ Could not navigate to project directory."
    exit 1
}

# Clear any Vite cache
echo "🧹 Clearing cache..."
rm -rf node_modules/.vite 2>/dev/null

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the development server on port 3000
echo "🌐 Starting development server on port 3000..."
echo "Open http://localhost:3000 in your browser"

# Run the server
npx vite --port 3000 --host
