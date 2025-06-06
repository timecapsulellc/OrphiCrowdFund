#!/bin/bash

# Start OrphiCrowdFund Development Server
echo "🚀 Starting OrphiCrowdFund Development Server..."
echo "📂 Working directory: $(pwd)"

# Run the Vite development server
echo "🌐 Running: npm run dev"
npm run dev

# Instructions if server fails to start
echo "🔴 If the server didn't start, try these commands manually:"
echo "cd \"/Users/dadou/Orphi CrowdFund\""
echo "npm run dev"
echo ""
echo "Or alternatively:"
echo "cd \"/Users/dadou/Orphi CrowdFund\""
echo "npx vite"
