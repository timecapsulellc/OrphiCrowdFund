import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("Dashboard component error:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default fallback UI
      return (
        <div style={{ 
          padding: '20px', 
          background: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '8px',
          margin: '20px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ color: '#d32f2f' }}>Component Error</h2>
          <p>Something went wrong loading this component.</p>
          <details style={{ 
            whiteSpace: 'pre-wrap', 
            marginTop: '10px',
            padding: '10px',
            background: 'rgba(0, 0, 0, 0.05)',
            borderRadius: '4px'
          }}>
            <summary>Show Error Details</summary>
            <p>{this.state.error && this.state.error.toString()}</p>
            <p>Component Stack:</p>
            <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
          </details>
          <button 
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: '15px',
              padding: '8px 16px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
