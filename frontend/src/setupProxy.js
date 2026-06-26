// Dev-only: proxy /api to the local backend so auth cookies stay same-origin
// (SameSite=Lax works on localhost:3000). Not used in production builds.
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: process.env.BACKEND_PROXY_TARGET || "http://localhost:8000",
      changeOrigin: true,
    })
  );
};
