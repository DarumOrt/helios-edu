// PDF.js загружает worker, шрифты и декодеры отдельными запросами.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = dirname(require.resolve("pdfjs-dist/package.json"));
const target = join("public", "pdfjs", require("pdfjs-dist/package.json").version);
mkdirSync(target, { recursive: true });
for (const name of ["cmaps", "standard_fonts", "wasm", "iccs", "build/pdf.worker.min.mjs"])
  cpSync(join(source, name), join(target, name), { recursive: true });
