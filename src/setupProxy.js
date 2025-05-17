const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/socket.io",
    createProxyMiddleware({
      target: "http://localhost:5000",
      changeOrigin: true,
      ws: true,
      logLevel: "debug",
      headers: {
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
          "GET, POST, OPTIONS, PUT, PATCH, DELETE",
        "Access-Control-Allow-Headers": "X-Requested-With,content-type",
      },
      onProxyReqWs: (proxyReq, req, socket) => {
        // Handle WebSocket proxy request
        socket.on("error", (err) => {
          console.log("WebSocket proxy error:", err);
        });
      },
      onError: (err, req, res) => {
        console.error("WebSocket proxy error:", err);
      },
    })
  );

  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:5000",
      changeOrigin: true,
      ws: true, // Enable WebSocket support for API routes too
      pathRewrite: {
        "^/api": "/api",
      },
      headers: {
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
      onError: (err, req, res) => {
        console.error("API proxy error:", err);
        // Send a more helpful error response
        if (res && res.writeHead && res.end) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ error: "Proxy error", message: err.message })
          );
        }
      },
    })
  );
};
