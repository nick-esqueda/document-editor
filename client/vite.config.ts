import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// In dev, the browser talks only to Vite, which forwards /api to the server.
// That keeps the app same-origin, just like production behind CloudFront.
const DEFAULT_API_PROXY_TARGET = "http://localhost:3000";
const DEV_SERVER_PORT = 5173;

export default defineConfig({
  plugins: [react()],
  server: {
    port: DEV_SERVER_PORT,
    strictPort: true,
    proxy: {
      "/api": process.env.API_PROXY_TARGET ?? DEFAULT_API_PROXY_TARGET,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setupTests.ts"],
  },
});
