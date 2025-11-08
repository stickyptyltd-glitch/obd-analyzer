import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          background: '#1a1a1a',
          color: '#ff4444',
          fontFamily: 'monospace',
          minHeight: '100vh'
        }}>
          <h1>❌ JavaScript Error Detected</h1>
          <h2>Error:</h2>
          <pre style={{
            background: '#000',
            padding: '20px',
            overflow: 'auto',
            border: '2px solid #ff4444',
            borderRadius: '8px'
          }}>
            {this.state.error?.toString()}
          </pre>

          <h2>Stack Trace:</h2>
          <pre style={{
            background: '#000',
            padding: '20px',
            overflow: 'auto',
            fontSize: '12px',
            border: '2px solid #ff4444',
            borderRadius: '8px'
          }}>
            {this.state.error?.stack}
          </pre>

          <h2>Component Stack:</h2>
          <pre style={{
            background: '#000',
            padding: '20px',
            overflow: 'auto',
            fontSize: '12px',
            border: '2px solid #ff4444',
            borderRadius: '8px'
          }}>
            {this.state.errorInfo?.componentStack}
          </pre>

          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#ff4444',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
