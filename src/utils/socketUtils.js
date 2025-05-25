/**
 * Socket.io utility functions for handling WebSocket connections
 * Improved version with better error handling and memory management
 */

import { io } from "socket.io-client";

// Track socket connection state globally
let isReconnecting = false;
let heartbeatInterval = null;
let currentSocket = null;

/**
 * Creates a configured socket.io instance with optimal settings
 * to prevent "Invalid frame header" errors and ECONNRESET issues
 *
 * @param {string} token - Authentication token
 * @returns {object} Configured socket.io instance
 */
export const createSocketConnection = (token) => {
  if (!token) {
    console.error("No token provided for socket connection");
    return null;
  }

  // Clean up any existing socket connection
  cleanupExistingConnection();

  // Create socket with balanced configuration
  const socket = io("http://localhost:5000", {
    query: { token },
    path: "/socket.io",
    transports: ["polling", "websocket"], // Start with polling first, then try websocket
    reconnection: true,
    reconnectionAttempts: 15, // Balanced for resilience without excessive attempts
    reconnectionDelay: 1000,
    reconnectionDelayMax: 3000, // Faster recovery
    timeout: 60000, // 60 seconds (balanced)
    forceNew: true,
    upgrade: true,
    rememberUpgrade: true,
    pingTimeout: 120000, // 120 seconds (increased for better stability)
    pingInterval: 25000, // 25 seconds (matched with server)
    autoConnect: true,
    withCredentials: true, // Enable credentials
  });

  // Store current socket reference
  currentSocket = socket;

  // Setup enhanced error handling and heartbeat
  setupEnhancedErrorHandling(socket);
  setupHeartbeat(socket);

  return socket;
};

/**
 * Cleans up any existing socket connection to prevent memory leaks
 */
const cleanupExistingConnection = () => {
  // Clear any existing heartbeat interval
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Clean up existing socket
  if (currentSocket) {
    try {
      // Remove all listeners to prevent memory leaks
      currentSocket.removeAllListeners();

      // Disconnect if connected
      if (currentSocket.connected) {
        currentSocket.disconnect();
      }

      // Reset the socket reference
      currentSocket = null;
      console.log("Previous socket connection cleaned up");
    } catch (err) {
      console.error("Error cleaning up socket:", err);
    }
  }

  // Reset reconnection state
  isReconnecting = false;
};

/**
 * Sets up a heartbeat mechanism to keep the connection alive
 * and detect disconnections early
 *
 * @param {object} socket - Socket.io instance
 */
const setupHeartbeat = (socket) => {
  if (!socket) return;

  // Clear any existing heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  // Set up heartbeat to prevent ECONNRESET errors with improved error handling
  heartbeatInterval = setInterval(() => {
    try {
      if (socket.connected) {
        // Send a heartbeat ping to keep the connection alive
        socket.emit("heartbeat");
        console.log("Heartbeat sent");
      } else if (!isReconnecting) {
        // If not connected and not already reconnecting, try to reconnect
        console.log("Connection appears down, attempting to reconnect...");
        attemptReconnection(socket);
      }
    } catch (err) {
      console.error("Error in heartbeat:", err);

      // If we get an error during heartbeat, clean up and restart
      if (err.message && err.message.includes("write after end")) {
        console.log(
          "Detected write after end in heartbeat, cleaning up connection"
        );
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        
        // Destroy the problematic socket and create a new one after a delay
        if (currentSocket) {
          try {
            currentSocket.removeAllListeners();
            currentSocket.disconnect();
          } catch (cleanupErr) {
            console.error("Error during emergency cleanup:", cleanupErr);
          }
          currentSocket = null;
        }
        
        // Allow time for resources to be released before attempting reconnection
        setTimeout(() => {
          isReconnecting = false;
          // Application should handle reconnection on next operation
        }, 2000);
      }
    }
  }, 25000); // Match server's ping interval (25 seconds)
};

/**
 * Attempts to reconnect the socket using a progressive strategy
 * with improved error handling
 *
 * @param {object} socket - Socket.io instance
 */
const attemptReconnection = (socket) => {
  if (isReconnecting || !socket) return;

  isReconnecting = true;
  console.log("Starting reconnection process...");

  try {
    // First try the built-in reconnection
    if (!socket.connected) {
      socket.connect();
    }

    // Set a timeout to check if reconnection was successful
    setTimeout(() => {
      try {
        if (!socket.connected) {
          console.log(
            "Built-in reconnection failed, trying alternative approach..."
          );

          // Reset connection options to start with polling
          if (socket.io) {
            socket.io.opts.transports = ["polling", "websocket"];
          }

          // Force disconnect and reconnect with proper error handling
          try {
            socket.disconnect();
          } catch (err) {
            console.error("Error during disconnect:", err);
          }

          // Short delay before reconnecting
          setTimeout(() => {
            try {
              // Check if socket is still valid before reconnecting
              if (socket && typeof socket.connect === "function") {
                socket.connect();
              } else {
                console.log(
                  "Socket is no longer valid, creating new connection"
                );
                // The application should handle creating a new connection
              }
            } catch (err) {
              console.error("Error during reconnect:", err);
            } finally {
              isReconnecting = false;
            }
          }, 1000);
        } else {
          isReconnecting = false;
        }
      } catch (err) {
        console.error("Error in reconnection check:", err);
        isReconnecting = false;
      }
    }, 3000); // Reduced timeout for faster recovery
  } catch (err) {
    console.error("Error initiating reconnection:", err);
    isReconnecting = false;
  }
};

/**
 * Sets up enhanced error handling for socket.io connections
 * with improved handling for common WebSocket errors
 *
 * @param {object} socket - Socket.io instance
 */
export const setupEnhancedErrorHandling = (socket) => {
  if (!socket) return;

  // Connection successful
  socket.on("connect", () => {
    console.log("Socket connected successfully");
    isReconnecting = false; // Reset reconnection flag on successful connection
    
    // Get user ID from localStorage and join personal room
    const user = localStorage.getItem("user");
    if (user) {
      try {
        const userData = JSON.parse(user);
        if (userData && userData.id) {
          socket.emit("join_personal_room", { userId: userData.id });
          console.log(`Joined personal room: ${userData.id}`);
        }
      } catch (err) {
        console.error("Error joining personal room:", err);
      }
    }
  });

  // Connection error handling
  socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err);

    // Handle write after end errors specifically
    if (err.message && err.message.includes("write after end")) {
      console.log("Write after end error detected, cleaning up connection");
      cleanupExistingConnection();
      return;
    }

    // Specifically handle ECONNRESET errors
    if (
      err.message &&
      (err.message.includes("ECONNRESET") || err.message.includes("timeout"))
    ) {
      console.log(
        "Connection reset or timeout detected, will attempt recovery..."
      );
      // Let the heartbeat mechanism handle reconnection
      return;
    }

    // For other errors, use the progressive reconnection strategy
    if (!isReconnecting) {
      attemptReconnection(socket);
    }
  });

  // General error handling
  socket.on("error", (err) => {
    console.error("Socket general error:", err);

    // Handle write after end errors specifically
    if (err.message && err.message.includes("write after end")) {
      console.log(
        "Write after end error detected in general handler, cleaning up connection"
      );
      cleanupExistingConnection();
      return;
    }

    // Check for network-related errors
    if (
      err.message &&
      (err.message.includes("ECONNRESET") ||
        err.message.includes("ETIMEDOUT") ||
        err.message.includes("EPIPE"))
    ) {
      console.log("Network error detected, will attempt recovery...");
      if (!isReconnecting) {
        attemptReconnection(socket);
      }
    }
  });

  // Reconnection events
  socket.on("reconnect", (attemptNumber) => {
    console.log(`Socket reconnected after ${attemptNumber} attempts`);
    isReconnecting = false;
  });

  socket.on("reconnect_error", (err) => {
    console.error("Socket reconnection error:", err);
    // If built-in reconnection is failing, try our custom approach
    if (!isReconnecting) {
      attemptReconnection(socket);
    }
  });

  socket.on("reconnect_failed", () => {
    console.error("Socket reconnection failed after all attempts");
    // Reset reconnection state to allow future attempts
    isReconnecting = false;

    // Clean up the failed connection completely
    cleanupExistingConnection();
  });

  // Disconnection handling
  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${reason}`);

    // If the disconnection was due to transport close, clean up properly
    if (reason === "transport close" || reason === "transport error") {
      console.log("Transport-related disconnection, cleaning up resources");
      // Don't immediately reconnect - let the application handle it
    }

    // For io server disconnect, we should clean up completely
    if (reason === "io server disconnect") {
      console.log("Server forced disconnect, cleaning up completely");
      cleanupExistingConnection();
    }

    // For ping timeout, we should attempt reconnection
    if (reason === "ping timeout") {
      console.log("Ping timeout detected, will attempt reconnection");
      if (!isReconnecting) {
        attemptReconnection(socket);
      }
    }

    // Handle transport close issues
    if (reason === "transport close" || reason === "transport error") {
      console.log("Transport-related disconnection, cleaning up resources");
      // Don't immediately reconnect - let the application handle it
    }
  });

  // Handle heartbeat response from server (if implemented on server)
  socket.on("heartbeat-ack", () => {
    console.log("Heartbeat acknowledged by server");
  });
};

/**
 * Safely disconnects and cleans up a socket connection
 * This should be called when a component unmounts to prevent memory leaks
 *
 * @param {object} socket - Socket.io instance to disconnect
 */
export const disconnectSocket = (socket) => {
  if (!socket) return;

  try {
    console.log("Safely disconnecting socket connection");

    // Remove all listeners to prevent memory leaks
    socket.removeAllListeners();

    // Disconnect if connected
    if (socket.connected) {
      socket.disconnect();
    }

    // If this is the current tracked socket, clean up global resources
    if (socket === currentSocket) {
      cleanupExistingConnection();
    }

    console.log("Socket disconnected successfully");
  } catch (err) {
    console.error("Error disconnecting socket:", err);
  }
};

/**
 * Cleanup function to properly dispose of socket resources
 * Call this when unmounting components or logging out
 *
 * @param {object} socket - Socket.io instance to clean up
 */
export const cleanupSocketConnection = (socket) => {
  if (!socket) return;

  // Clear heartbeat interval
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Reset reconnection state
  isReconnecting = false;

  // Disconnect socket if connected
  if (socket.connected) {
    socket.disconnect();
  }

  console.log("Socket connection cleaned up");
};
