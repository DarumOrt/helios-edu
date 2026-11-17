// Windows: используем Bash установленного Git, а не системный запускатель WSL.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

let bash = "bash";
if (process.platform === "win32") {
  const gitPaths = spawnSync("where.exe", ["git"], { encoding: "utf8" });
  const candidates = (gitPaths.stdout ?? "")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((git) => resolve(dirname(git), "..", "bin", "bash.exe"));
  bash = candidates.find(existsSync);
  if (!bash) {
    console.error("Не найден Git Bash. Установите Git for Windows и добавьте git в PATH.");
    process.exit(1);
  }
}

const result = spawnSync(bash, process.argv.slice(2), { stdio: "inherit" });
if (result.error) console.error(`Не удалось запустить Bash: ${result.error.message}`);
process.exit(result.status ?? 1);
