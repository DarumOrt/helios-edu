import { NextResponse } from "next/server";
import { findProgram, updateProgram } from "@/mocks/program-store";
import { parseProgram } from "@/mocks/program-validation";
import { demoActorWith, fail, readJson } from "@/mocks/management-guards";
import { audit } from "@/mocks/audit-store";
import { getDataSource } from "@/shared/lib/backend";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const program = findProgram((await params).id);
  return program ? NextResponse.json(program) : fail(404, "not found");
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if ((await getDataSource()).source === "demo") {
    const actor = await demoActorWith("program.manage");
    if (actor instanceof NextResponse) return actor;
  }
  if (!findProgram(id)) return fail(404, "not found");
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  const { out, fields } = parseProgram(body, true);
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  const program = updateProgram(id, out)!;
  await audit("Изменена программа", program.title);
  return NextResponse.json(program);
}
