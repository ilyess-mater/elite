/**
 * Socket.io utility functions for handling WebSocket connections
 */

import { io } from "socket.io-client";

/**
 * Creates a configured socket.io instance with optimal settings
 * to prevent "Invalid frame header" errors on various ports
 *
 * @param {string} token - Authentication token
 * @returns {object} Configured socket.io instance
 */
export const createSocketConnection = (token) => {
  if (!token) {
    console.error("No token provided for socket connection");
    return null;
  }

  // Create socket with optimized configuration
  const socket = io({
    query: { token },
    path: "/socket.io",
    transports: ["polling", "websocket"], // Start with polling first, then try websocket
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
    forceNew: true,
    upgrade: true,
    rememberUpgrade: true,
  });

  // Setup enhanced error handling
  setupEnhancedErrorHandling(socket);

  return socket;
};

/**
 * Sets up enhanced error handling for socket.io connections
 *
 * @param {object} socket - Socket.io instance
 */
export const setupEnhancedErrorHandling = (socket) => {
  if (!socket) return;

  // Connection successful
  socket.on("connect", () => {
    console.log("Socket connected successfully");
  });

  // Connection error handling
  socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err);

    // Force close and reconnect with polling first
    if (socket.io) {
      socket.io.opts.transports = ["polling", "websocket"];
      socket.io.opts.upgrade = true;

      // Add a small delay before reconnection attempt
      setTimeout(() => {
        socket.connect();
      }, 1000);
    }
  });

  // General error handling
  socket.on("error", (err) => {
    console.error("Socket general error:", err);
  });

  // Reconnection events
  socket.on("reconnect", (attemptNumber) => {
    console.log(`Socket reconnected after ${attemptNumber} attempts`);
  });

  socket.on("reconnect_error", (err) => {
    console.error("Socket reconnection error:", err);
  });

  socket.on("reconnect_failed", () => {
    console.error("Socket reconnection failed after all attempts");
  });

  // Disconnection handling
  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${reason}`);

    // If server disconnected us, try to reconnect
    if (reason === "io server disconnect") {
      socket.connect();
    }
  });
};
