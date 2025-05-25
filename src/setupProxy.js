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
      // Increase WebSocket timeout values - match server configuration
      timeout: 120000, // 120 seconds
      proxyTimeout: 120000, // 120 seconds
      // Prevent socket hangup by keeping connections alive
      keepAlive: true,
      // Increase buffer size to handle larger messages
      buffer: {
        pipe: true,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      },
      // Important: Set proper websocket options
      websocket: true,
      onProxyReqWs: (proxyReq, req, socket) => {
        // Set keep-alive on the socket with increased timeout
        socket.setKeepAlive(true, 120000); // Match server timeout of 120 seconds

        // Increase socket timeout
        socket.setTimeout(120000); // 120 seconds timeout

        // Disable Nagle's algorithm for better real-time performance
        socket.setNoDelay(true);

        // Handle WebSocket proxy request errors
        socket.on("error", (err) => {
          console.log("WebSocket proxy error:", err);

          // Only log connection reset errors, don't attempt further handling here
          // The socket.io client will handle reconnection
          if (err.code === "ECONNRESET") {
            console.log("WebSocket connection reset (ECONNRESET)");
            return;
          }
          
          if (err.code === "ERR_STREAM_WRITE_AFTER_END") {
            console.log("WebSocket write after end error, this is expected during reconnection");
            return;
          }
        });

        // Handle connection events
        socket.on("timeout", () => {
          console.log("WebSocket proxy socket timeout detected");
        });

        socket.on("end", () => {
          console.log("WebSocket proxy socket ended normally");
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
      ws: false, // Disable WebSocket for regular API routes
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
