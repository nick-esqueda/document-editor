import { defineConfig } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const SERVER_START_TIMEOUT_MS = 120_000;

/**
 * End-to-end tests drive the real app in Chromium.
 * If the app is already running (docker compose up), those servers are reused;
 * otherwise Playwright starts the API and the Vite dev server itself.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: BASE_URL },
  webServer: process.env.BASE_URL
    ? undefined
    : [
        {
          command: "npm run dev -w server",
          url: "http://localhost:3000/api/auth/me",
          reuseExistingServer: true,
          timeout: SERVER_START_TIMEOUT_MS,
        },
        {
          command: "npm run dev -w client",
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: SERVER_START_TIMEOUT_MS,
        },
      ],
});
