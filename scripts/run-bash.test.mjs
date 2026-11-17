import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const runner = fileURLToPath(new URL("./run-bash.mjs", import.meta.url));
const run = (...args) => spawnSync(process.execPath, [runner, ...args], { encoding: "utf8" });

test("Bash получает аргументы с пробелами и метасимволами без повторного разбора", () => {
  const result = run("-c", 'printf "%s" "$1"', "test", "папка с пробелами; $(echo unwanted)");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "папка с пробелами; $(echo unwanted)");
});

test("ошибка Bash передаётся вызывающему npm без потери кода", () => {
  assert.equal(run("-c", "exit 7").status, 7);
});
