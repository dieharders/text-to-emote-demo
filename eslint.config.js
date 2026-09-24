import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "dist", ".dev-data", "src/client/generated.css"] },

  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser, Bun: "readonly" },
    },
    rules: {
      // `_` prefix = unused on purpose.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },

  // MODULE BOUNDARIES (see README → Architecture). These keep the model swappable: only the
  // registry knows which engines exist, and only the Von engine knows Von.
  {
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
    ignores: ["src/engines/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "von-sdk", message: "Only src/engines/von may use von-sdk." }],
          patterns: [
            // `engines/types` (the interface) is fine; a specific engine is not.
            { regex: "(^|/)engines/(?!types$)[^/]+", message: "Load engines through the registry (src/engines/index.ts), not directly." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/client/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "von-sdk", message: "The client talks to the server's /api, never to an engine." }],
          patterns: [
            { regex: "(^|/)(server|engines)(/|$)", message: "The client may only import from src/shared (the API contract)." },
          ],
        },
      ],
    },
  },

  // `declare var self: Worker` is a type-only declaration; `var` is the idiomatic form there.
  { files: ["src/worker.ts"], rules: { "no-var": "off" } },
);
