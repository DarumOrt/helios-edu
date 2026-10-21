import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  // Границы слоёв (см. AGENTS.md). UI получает данные только через /api/* — моки доступны лишь route handlers.
  {
    files: ["src/features/**/*.{ts,tsx}", "src/app/(app)/**/*.{ts,tsx}", "src/shared/layout/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/mocks/*"], message: "UI ходит за данными через /api/*, не в моки" }] },
      ],
    },
  },
  // shared не знает про features и app. shared/layout — исключение: это оболочка приложения, она собирает фичи.
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    ignores: ["src/shared/layout/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/features/*", "@/app/*"], message: "shared не должен зависеть от features/app" },
            { group: ["@/mocks/*"], message: "UI ходит за данными через /api/*, не в моки" },
          ],
        },
      ],
    },
  },
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    ".claude/**",
    ".codex/**",
    "**/bin/**",
    "**/obj/**",
  ]),
]);
