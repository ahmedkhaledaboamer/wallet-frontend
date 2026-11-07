import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end against the REAL stack (backend API + worker on :4000, frontend on :3000 in live mode).
 * Start everything first (..\start-all.ps1), then: npm run test:e2e:live
 * One worker, headless (low-RAM machine; the tests also share backend state in order).
 */
export default defineConfig({
  testDir: "./e2e/live",
  testMatch: /.*\.spec\.ts/,
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PW_BASE_URL ?? "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 90_000,
    actionTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
