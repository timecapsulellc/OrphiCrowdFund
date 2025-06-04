# OrphiChain Dashboard Frontend

This directory contains the main entry point for the OrphiChain Dashboard frontend application.

## Files

- `main.jsx` - Application entry point that mounts the React app to the DOM
- `App.jsx` - Main application component that handles routing and layout
- `App.css` - Global application styles

## Running the Application

From the project root directory:

```bash
npm start
```

This will start the development server, typically on port 3000 or 3001.

## Component Demo

The main App component provides a tabbed interface to showcase all the dashboard components:

1. Logo Demo - Demonstrates the animated OrphiChain logo in various forms
2. Orphi Dashboard - Complete dashboard with network visualization and analytics
3. Team Analytics - Team performance metrics and export functionality
4. Genealogy Tree - Interactive network relationship visualization
5. Network Visualization - Force-directed graph of the entire network

## Component Integration

To use these components in your own application:

1. Import the required component from `/docs/components/`
2. Import associated CSS files
3. Use the component in your JSX

Example:

```jsx
import OrphiChainLogo from '../docs/components/OrphiChainLogo';
import '../docs/components/OrphiChainLogo.css';

function MyApp() {
  return (
    <div>
      <h1>My OrphiChain App</h1>
      <OrphiChainLogo size="medium" variant="orbital" />
    </div>
  );
}
```

## Connecting to Smart Contracts

The next phase of development will involve connecting these components to the OrphiChain smart contracts for real-time data. This will be implemented using Web3 providers and contract ABIs.

## Mobile Optimization

All components are designed to be responsive and work well on mobile devices.
