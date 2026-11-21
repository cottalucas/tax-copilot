import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000,
    // The test files share one set of emulators and each clears it: run them one at a time.
    fileParallelism: false,
  },
});
