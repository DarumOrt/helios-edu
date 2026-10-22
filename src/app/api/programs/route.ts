import { NextResponse } from "next/server";
import { createProgram, listPrograms } from "@/mocks/program-store";
import { parseProgram } from "@/mocks/program-validation";
import { demoActorWith, fail, readJson } from "@/mocks/management-guards";
import { audit } from "@/mocks/audit-store";
import { getDataSource } from "@/shared/lib/backend";
import type { Program } from "@/shared/types/domain";

export async function GET() {
  return NextResponse.json(listPrograms());
}

// POST { title, description, rule, courseIds } — программа обучения (program.manage)
export async function POST(req: Request) {
  // сервер: права проверил proxy.ts; демо — здесь
  if ((await getDataSource()).source === "demo") {
    const actor = await demoActorWith("program.manage");
    if (actor instanceof NextResponse) return actor;
  }
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  const { out, fields } = parseProgram(body, false);
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  const program = createProgram(out as Omit<Program, "id">);
  await audit("Создана программа", program.title);
  return NextResponse.json(program, { status: 201 });
}
