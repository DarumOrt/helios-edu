import { NextResponse } from "next/server";
import { backendForward } from "@/shared/lib/backend";
import { demoCourseEditor, fail, readJson, str } from "@/mocks/management-guards";
import { enrollmentInfo, enrollStudent, setKeyword } from "@/mocks/enrollment-store";
import { allDemoUsers, findDemoUser } from "@/mocks/users-store";
import { keywordError } from "@/shared/lib/enrollment";

type Ctx = { params: Promise<{ id: string; path?: string[] }> };
async function handle(req: Request, { params }: Ctx) {
  const { id, path = [] } = await params;
  const suffix = path.map(encodeURIComponent).join("/");
  const forwarded = await backendForward(
    req,
    `/api/courses/${encodeURIComponent(id)}/enrollment${suffix ? `/${suffix}` : ""}${new URL(req.url).search}`,
  );
  if (forwarded) return forwarded;
  const editor = await demoCourseEditor(id);
  if (editor instanceof Response) return editor;
  const { actor } = editor;
  if (req.method === "GET" && !suffix) return NextResponse.json(enrollmentInfo(id, actor.tenantId));
  if (req.method === "GET" && suffix === "students") {
    const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
    return NextResponse.json(
      q.length < 2 || q.length > 100
        ? []
        : allDemoUsers()
            .filter(
              (u) =>
                u.role === "student" &&
                u.status !== "blocked" &&
                u.tenantId === actor.tenantId &&
                (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
            )
            .sort((a, b) => a.name.localeCompare(b.name, "ru"))
            .slice(0, 20)
            .map((u) => ({ id: u.id, name: u.name, email: u.email, group: u.group, source: "manual" })),
    );
  }
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  if (req.method === "PUT" && suffix === "key") {
    const error = body.keyword === null ? undefined : keywordError(body.keyword);
    if (error) return fail(400, "Проверьте поля формы", { keyword: error });
    setKeyword(id, body.keyword === null ? null : str(body.keyword)!);
  } else if (req.method === "POST" && suffix === "students") {
    const student = findDemoUser(str(body.userId) ?? "");
    if (
      !student ||
      student.role !== "student" ||
      student.status === "blocked" ||
      student.tenantId !== actor.tenantId
    )
      return fail(400, "Проверьте поля формы", { userId: "Выберите действующего студента" });
    enrollStudent(id, student.id, "manual");
  } else return fail(404, "not found");
  return NextResponse.json({ ok: true });
}
export { handle as GET, handle as POST, handle as PUT };
