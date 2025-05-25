import React, { Component } from 'react';
import { createSocketConnection } from '../utils/socketUtils';

/**
 * WebSocketErrorBoundary catches WebSocket-related errors and provides recovery strategies
 * to prevent application crashes and improve user experience when socket connections fail.
 */
class WebSocketErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      errorInfo: null,
      isRecovering: false,
      recoveryAttempts: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Check if the error is WebSocket related
    const isWebSocketError = 
      (error.message && (
        error.message.includes('WebSocket') || 
        error.message.includes('socket') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('write after end')
      )) || 
      (errorInfo.componentStack && errorInfo.componentStack.includes('socket'));

    console.error('WebSocketErrorBoundary caught an error:', error);
    console.log('Component stack:', errorInfo.componentStack);

    this.setState({ 
      errorInfo,
      isWebSocketError
    });

    // Attempt automatic recovery for WebSocket errors
    if (isWebSocketError) {
      this.attemptRecovery();
    }
  }

  attemptRecovery = () => {
    const { recoveryAttempts } = this.state;
    const maxRecoveryAttempts = 3;
    
    if (recoveryAttempts < maxRecoveryAttempts) {
      this.setState({
        isRecovering: true,
        recoveryAttempts: recoveryAttempts + 1
      });

      console.log(`Attempting WebSocket recovery (${recoveryAttempts + 1}/${maxRecoveryAttempts})...`);

      // Wait a moment before attempting to reconnect
      setTimeout(() => {
        try {
          // Get the current token from localStorage
          const token = localStorage.getItem('token');
          
          if (token) {
            // Create a new socket connection
            console.log('Creating new socket connection...');
            const newSocket = createSocketConnection(token);
            
            // If the socket connects successfully within 5 seconds, reset the error state
            const connectionTimeout = setTimeout(() => {
              // If we reach this point, connection wasn't established in time
              console.log('Socket connection timeout - recovery failed');
              this.setState({ isRecovering: false });
            }, 5000);

            // Listen for a successful connection
            if (newSocket) {
              newSocket.once('connect', () => {
                clearTimeout(connectionTimeout);
                console.log('Socket reconnected successfully');
                
                // Reset the error state to allow rendering the main application again
                this.setState({
                  hasError: false,
                  isRecovering: false
                });
              });
            } else {
              this.setState({ isRecovering: false });
            }
          } else {
            console.log('No authentication token found, cannot reconnect socket');
            this.setState({ isRecovering: false });
          }
        } catch (e) {
          console.error('Error during recovery attempt:', e);
          this.setState({ isRecovering: false });
        }
      }, 2000);
    } else {
      // We've reached max recovery attempts
      console.log('Maximum recovery attempts reached');
      this.setState({ isRecovering: false });
    }
  };

  handleManualRetry = () => {
    // Reset recovery attempts and try again
    this.setState({
      recoveryAttempts: 0,
      hasError: false
    }, this.attemptRecovery);
  };

  handleRefresh = () => {
    // Hard refresh the page
    window.location.reload();
  };

  render() {
    const { hasError, isRecovering, recoveryAttempts, isWebSocketError } = this.state;

    if (hasError) {
      // Show different UI based on whether we're trying to recover
      return (
        <div className="websocket-error-container" style={{
          padding: '20px',
          margin: '20px auto',
          maxWidth: '500px',
          border: '1px solid #f0f0f0',
          borderRadius: '8px',
          backgroundColor: '#fff',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#d32f2f' }}>Connection Issue Detected</h2>
          
          {isRecovering ? (
            <div>
              <p>Attempting to reconnect... ({recoveryAttempts}/3)</p>
              <div className="loading-spinner" style={{
                margin: '20px auto',
                borderTop: '4px solid #3498db',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                animation: 'spin 1s linear infinite'
              }}></div>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          ) : (
            <div>
              <p>We're having trouble connecting to the messaging service.</p>
              
              {isWebSocketError ? (
                <>
                  <p>This may be due to a network issue or server disconnection.</p>
                  <div style={{ margin: '20px 0' }}>
                    <button 
                      onClick={this.handleManualRetry}
                      style={{
                        backgroundColor: '#4caf50',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        margin: '0 10px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Try to Reconnect
                    </button>
                    <button 
                      onClick={this.handleRefresh}
                      style={{
                        backgroundColor: '#2196f3',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        margin: '0 10px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Refresh Page
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>Please refresh the page and try again.</p>
                  <button 
                    onClick={this.handleRefresh}
                    style={{
                      backgroundColor: '#2196f3',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      margin: '20px 0',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Refresh Page
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default WebSocketErrorBoundary;