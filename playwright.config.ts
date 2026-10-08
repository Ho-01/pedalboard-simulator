import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 600000,
  workers: 1,
  expect: { timeout: 30000 },
  use: {
    baseURL: process.env.PEDAL_TEST_URL ?? "http://127.0.0.1:5173",
    headless: true,
    launchOptions: process.env.PEDAL_CHROMIUM_PATH
      ? { executablePath: process.env.PEDAL_CHROMIUM_PATH }
      : undefined,
    navigationTimeout: 90000,
    actionTimeout: 30000,
  },
  reporter: "list",
});
