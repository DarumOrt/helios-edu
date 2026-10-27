import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Модульные тесты правил: права, валидация, формулы. Запуск — npm test (то же в CI).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // серверные модули моков подключают "server-only" — в тестах это пустой модуль
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
