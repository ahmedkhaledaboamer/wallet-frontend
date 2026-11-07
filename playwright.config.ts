import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs in mock API mode against a production build (`npm run build` first).
 * Set PW_BASE_URL to point at an already-running server (e.g. `next dev`) instead.
 */
const PORT = 3300;
const baseURL = process.env.PW_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `${baseURL}/login`,
        reuseExistingServer: true,
        timeout: 120_000,
        env: { NEXT_PUBLIC_API_MODE: "mock" },
      },
});
