import { NextResponse } from "next/server";
import { backendForward, isSameOrigin } from "@/shared/lib/backend";
import { demoFaculties } from "@/mocks/faculties-store";
import { audit } from "@/mocks/audit-store";
import { demoActorWith, fail, readJson, str } from "@/mocks/management-guards";

export async function GET(req: Request) {
  return (await backendForward(req, "/api/faculties")) ?? NextResponse.json(demoFaculties());
}

export async function POST(req: Request) {
  const forwarded = await backendForward(req, "/api/faculties");
  if (forwarded) return forwarded;
  if (!isSameOrigin(req)) return fail(403, "Недостаточно прав");
  const actor = await demoActorWith("system.manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readJson(req);
  const code = str(body?.code) ?? "",
    name = str(body?.name) ?? "";
  if (!/^[\p{L}\p{N} -]{1,50}$/u.test(code) || name.length < 2 || name.length > 180)
    return fail(400, "Проверьте код и название факультета");
  if (demoFaculties().some((f) => f.code.toUpperCase() === code.toUpperCase()))
    return fail(409, "Такой код уже есть");
  const item = { code, name, archived: false };
  demoFaculties().push(item);
  await audit("faculty.created", name);
  return NextResponse.json(item, { status: 201 });
}
