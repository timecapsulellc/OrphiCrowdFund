# OrphiChain Dashboard Frontend - Local Development Guide

This guide explains how to set up and run the OrphiChain Dashboard components locally for development and testing.

## Overview

The OrphiChain Dashboard is a React-based frontend that provides visualizations, analytics, and interactive components for the OrphiChain matrix-based compensation system. It includes the following key features:

1. **Animated OrphiChain Logo** - Brand-compliant animated logo with multiple variants
2. **Export Functionality** - Export analytics data as PDF, CSV, or via Email
3. **Genealogy Tree Visualization** - Interactive D3-based network tree visualization
4. **Team Analytics Dashboard** - Comprehensive analytics and reporting interface
5. **Mobile-Responsive Design** - Optimized for all device sizes

## Prerequisites

- Node.js (v16.0.0 or later)
- npm (v7.0.0 or later)

## Installation

1. Clone the repository (if you haven't already)
2. Navigate to the project root directory
3. Install dependencies:

```bash
npm install
```

## Running the Development Server

To start the local development server:

```bash
npm run dev
# OR
npm start
```

This will start the Vite development server, typically on port 3000 (or the next available port if 3000 is in use).

## Available Scripts

- `npm start` or `npm run dev` - Start the development server
- `npm run build` - Build the frontend for production
- `npm run preview` - Preview the production build locally

## Components Overview

### OrphiDashboard

The primary dashboard component that integrates all OrphiChain analytics and visualization features.

**Features:**
- System statistics with OrphiChain branding
- User activity monitoring
- Pool balance distribution visualization
- Registration trends and analytics
- Network genealogy tree visualization
- Real-time activity feeds
- Alert system for system events
- Export functionality for reports

**Demo Mode:**
For local development without a blockchain connection, use the `demoMode` prop:

```jsx
import { OrphiDashboard } from '../docs/components/OrphiDashboard';

function App() {
  return (
    <div className="app">
      <OrphiDashboard demoMode={true} />
    </div>
  );
}
```

**Live Contract Mode:**
To connect to a real OrphiChain contract:

```jsx
import { OrphiDashboard } from '../docs/components/OrphiDashboard';
import { ethers } from 'ethers';

function App() {
  // Example with MetaMask provider
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  
  return (
    <div className="app">
      <OrphiDashboard 
        contractAddress="0x123...abc" 
        provider={provider} 
      />
    </div>
  );
}
```

**Testing the Dashboard:**
1. Run the development server: `npm run dev`
2. Open your browser to the local development URL (typically http://localhost:3000)
3. The dashboard should load in demo mode by default
4. Test all interactive features: tree navigation, alerts, export functions
5. If connecting to a contract, verify real-time updates from blockchain events

### OrphiChainLogo

The animated logo component with three variants:
- Orbital (concentric orbits with nodes)
- Hexagonal (network grid)
- Chain (connected links)

```jsx
import OrphiChainLogo from './components/OrphiChainLogo';

// Usage
<OrphiChainLogo 
  size="medium" 
  variant="orbital" 
  showControls={true} 
  autoRotate={false} 
/>
```

### ExportPanel

Reusable component for exporting dashboard data:

```jsx
import ExportPanel from './components/ExportPanel';

// Usage
<ExportPanel 
  data={analyticsData} 
  filename="team-report" 
  title="Team Analytics Report" 
/>
```

### GenealogyTreeDemo

Interactive network visualization using react-d3-tree:

```jsx
import GenealogyTreeDemo from './components/GenealogyTreeDemo';

// Usage
<GenealogyTreeDemo />
```

### TeamAnalyticsDashboard

Comprehensive dashboard with charts and analytics:

```jsx
import TeamAnalyticsDashboard from './components/TeamAnalyticsDashboard';

// Usage
<TeamAnalyticsDashboard />
```

## Project Structure

- `/docs/components/` - React components
- `/docs/components/utils/` - Utility classes and helper functions
- `/src/` - Application entry point and main App component

## Troubleshooting

If you encounter missing dependencies, make sure you've installed all required packages:

```bash
npm install react react-dom react-d3-tree recharts d3 jspdf html2canvas file-saver
```

## Next Steps

1. **Connect to Backend** - Integrate with OrphiChain smart contracts
2. **Performance Optimization** - Implement virtualization for large networks
3. **Authentication** - Add user authentication and role-based access
4. **Real-time Updates** - Enhance event listeners for live data updates

## License

MIT License
