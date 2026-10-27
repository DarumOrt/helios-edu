// Типы TypeScript из описания C# API (OpenAPI). Запуск: npm run api:types (нужен запущенный API).
//   API_URL=http://127.0.0.1:8080 — откуда брать описание (по умолчанию локальный Docker);
//   --from-file — не ходить в API, пересобрать типы из сохранённого docs/api/openapi.json.
// Результат: docs/api/openapi.json и src/shared/types/api.gen.ts. Их коммитят вместе с изменением C#;
// CI сравнивает с тем, что отдаёт свежий API, а src/shared/types/contract.ts сверяет с типами интерфейса.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SPEC = "docs/api/openapi.json";
const OUT = "src/shared/types/api.gen.ts";

let spec;
if (process.argv.includes("--from-file")) spec = JSON.parse(readFileSync(SPEC, "utf8"));
else {
  const base = (process.env.API_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
  const response = await fetch(`${base}/openapi/v1.json`);
  if (!response.ok) throw new Error(`Описание API недоступно: ${response.status} ${base}/openapi/v1.json`);
  spec = await response.json();
  // адрес сервера зависит от того, где запущен API, — в сохранённое описание не попадает
  delete spec.servers;
  writeFileSync(SPEC, JSON.stringify(spec, null, 2) + "\n");
}

/** JSON Schema → тип TypeScript. Числа .NET описывает как ["integer", "string"] — это число. */
function toType(schema) {
  if (!schema) return "unknown";
  if (schema.$ref) return schema.$ref.split("/").at(-1);
  const types = [schema.type ?? []].flat();
  const nullable = types.includes("null") ? " | null" : "";
  if (types.includes("integer") || types.includes("number")) return `number${nullable}`;
  if (types.includes("boolean")) return `boolean${nullable}`;
  if (types.includes("array")) return `${wrap(toType(schema.items))}[]${nullable}`;
  if (types.includes("string")) return `string${nullable}`;
  if (types.includes("object") || schema.properties) {
    if (schema.properties) return objectType(schema) + nullable;
    if (schema.additionalProperties)
      return `Record<string, ${toType(schema.additionalProperties)}>${nullable}`;
    return `Record<string, unknown>${nullable}`;
  }
  return "unknown";
}

const wrap = (t) => (/[|&]/.test(t) ? `(${t})` : t);

function objectType(schema) {
  const required = new Set(schema.required ?? []);
  const fields = Object.entries(schema.properties ?? {}).map(
    ([name, prop]) => `  ${name}${required.has(name) ? "" : "?"}: ${toType(prop)};`,
  );
  return `{\n${fields.join("\n")}\n}`;
}

const schemas = Object.entries(spec.components?.schemas ?? {}).sort(([a], [b]) => a.localeCompare(b));
const body = schemas.map(([name, schema]) => `export type ${name} = ${toType(schema)};`).join("\n\n");
writeFileSync(
  OUT,
  `// Сгенерировано scripts/api-types.mjs из ${SPEC} — не править руками.\n// C# не пишет null в ответы (JsonIgnoreCondition.WhenWritingNull): поле «| null» на деле просто отсутствует.\n\n${body}\n`,
);
execFileSync(process.execPath, ["node_modules/prettier/bin/prettier.cjs", "--write", SPEC, OUT], {
  stdio: "ignore",
});
process.stdout.write(`Схем: ${schemas.length} → ${OUT}\n`);
