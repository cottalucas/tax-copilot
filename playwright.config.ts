import { defineConfig, devices } from "@playwright/test";

const port = 4173;

export default defineConfig({
  testDir: "tests/e2e",
  // A fake Vertex endpoint, so the real functions run on the emulator without a model.
  globalSetup: "./tests/e2e/global-setup.ts",
  // The tests share the Auth and Firestore emulators: one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${port}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Built against the Auth and Firestore emulators (npm run test:e2e starts them).
    command: `VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-tax-copilot npm run build:web && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
