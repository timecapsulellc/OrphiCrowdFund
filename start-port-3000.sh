#!/bin/bash

# Clear cache and restart server on port 3000
echo "🧹 Clearing cache and node_modules/.vite..."
rm -rf node_modules/.vite

echo "🚀 Starting OrphiCrowdFund Development Server on port 3000..."
echo "📂 Working directory: $(pwd)"

# Run the Vite development server
echo "🌐 Running: npm run dev"
npm run dev

echo "The server should now be running at http://localhost:3000"
