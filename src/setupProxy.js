const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/socket.io",
    createProxyMiddleware({
      target: "http://localhost:5000",
      changeOrigin: true,
      ws: true,
      logLevel: "debug",
      secure: false,
      xfwd: false,
      headers: {
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
          "GET, POST, OPTIONS, PUT, PATCH, DELETE",
        "Access-Control-Allow-Headers":
          "X-Requested-With,content-type,Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
      // Increase WebSocket timeout values
      timeout: 120000, // 120 seconds (increased)
      proxyTimeout: 120000, // 120 seconds (increased)
      // Prevent socket hangup by keeping connections alive
      keepAlive: true,
      // Increase buffer size to handle larger messages
      buffer: {
        pipe: true,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer (increased)
      },
      onProxyReqWs: (proxyReq, req, socket) => {
        // Set keep-alive on the socket with increased timeout
        socket.setKeepAlive(true, 60000); // 60 seconds keep-alive (increased)

        // Increase socket timeout
        socket.setTimeout(120000); // 120 seconds timeout

        // Disable Nagle's algorithm for better real-time performance
        socket.setNoDelay(true);

        // Increase socket buffer size
        if (socket.bufferSize !== undefined) {
          socket.bufferSize = 64 * 1024; // 64KB buffer size
        }

        // Handle WebSocket proxy request
        socket.on("error", (err) => {
          console.log("WebSocket proxy error:", err);

          // Don't immediately destroy the socket on error
          if (socket && !socket.destroyed) {
            console.log(
              "Socket error occurred but keeping connection alive if possible"
            );

            // Attempt to recover from ECONNRESET errors
            if (err.code === "ECONNRESET" || err.code === "ETIMEDOUT") {
              console.log(
                `Connection issue detected in proxy (${err.code}), attempting recovery...`
              );

              // Don't destroy the socket, let the client reconnect
              return;
            }
          }
        });

        // Add additional event handlers for better error detection
        socket.on("timeout", () => {
          console.log("WebSocket proxy socket timeout");
          // Don't destroy the socket on timeout, let reconnection handle it
        });

        socket.on("end", () => {
          console.log("WebSocket proxy socket ended");
        });
      },
      onError: (err, req, res) => {
        console.error("WebSocket proxy error:", err);

        // Send a more helpful error response
        if (res && res.writeHead && res.end) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "WebSocket proxy error",
              message: err.message,
              code: err.code,
            })
          );
        }
      },
    })
  );

  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:5000",
      changeOrigin: true,
      ws: true, // Enable WebSocket support for API routes too
      secure: false,
      xfwd: false,
      pathRewrite: {
        "^/api": "/api",
      },
      headers: {
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
          "GET, POST, OPTIONS, PUT, PATCH, DELETE",
        "Access-Control-Allow-Headers":
          "X-Requested-With,content-type,Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
      // Increase timeout values
      timeout: 120000, // 120 seconds
      proxyTimeout: 120000, // 120 seconds
      // Prevent connection hangup
      keepAlive: true,
      onError: (err, req, res) => {
        console.error("API proxy error:", err);
        // Send a more helpful error response
        if (res && res.writeHead && res.end) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Proxy error",
              message: err.message,
              code: err.code,
            })
          );
        }
      },
    })
  );

  // Add a health check endpoint to verify proxy is working
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", message: "Proxy server is running" });
  });
};
