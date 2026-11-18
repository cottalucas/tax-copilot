import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["node_modules", "lib", "dist", "coverage", "playwright-report", "test-results", "evals/runs"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Every model call goes through src/models. Block direct SDK imports elsewhere.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "openai", message: "Call models through src/models only (AGENTS.md)." },
            { name: "@anthropic-ai/sdk", message: "Call models through src/models only (AGENTS.md)." },
            { name: "@google-cloud/vertexai", message: "Call models through src/models only (AGENTS.md)." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/models/**"],
    rules: { "no-restricted-imports": "off" },
  },
);
