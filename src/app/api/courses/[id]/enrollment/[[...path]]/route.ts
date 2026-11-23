import { NextResponse } from "next/server";
import { backendForward } from "@/shared/lib/backend";
import { demoCourseEditor, fail, readJson, str } from "@/mocks/management-guards";
import {
  enrollmentInfo,
  excludeStudents,
  restoreStudent,
  isExcluded,
  enrollStudent,
  removeIndividualEnrollment,
  setKeyword,
} from "@/mocks/enrollment-store";
import { allDemoUsers, findDemoUser } from "@/mocks/users-store";
import { findCohort, updateCohort } from "@/mocks/cohorts-store";
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
            .map((u) => ({ id: u.id, name: u.name, email: u.email, group: u.group, sources: [] })),
    );
  }
  if (req.method === "DELETE" && path.length === 2 && path[0] === "students") {
    const student = findDemoUser(path[1]);
    if (student?.role !== "student" || student.tenantId !== actor.tenantId) return fail(404, "not found");
    removeIndividualEnrollment(id, student.id);
    return new NextResponse(null, { status: 204 });
  }
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  if (req.method === "POST" && path[0] === "access" && path.length === 3) {
    const [, action, target] = path;
    const info = enrollmentInfo(id, actor.tenantId);
    if (action === "exclude") {
      if (!info.students.some((s) => s.id === target)) return fail(404, "Участник не найден");
      excludeStudents(id, [target]);
    } else if (action === "restore") {
      const student = findDemoUser(target);
      if (student?.role !== "student" || student.tenantId !== actor.tenantId) return fail(404, "not found");
      restoreStudent(id, student);
    } else if (action === "exclude-group" || action === "detach") {
      const group = findCohort(target);
      if (!group || (action === "detach" && !info.cohortIds.includes(target)))
        return fail(404, "Группа не назначена курсу");
      const affected = info.students
        .filter((s) => s.group === group.name && (action !== "detach" || s.sources.length === 1))
        .map((s) => s.id);
      const confirmed = body.studentIds;
      if (!Array.isArray(confirmed)) return fail(400, "Подтвердите состав группы");
      if (new Set(confirmed).size !== affected.length || affected.some((id) => !confirmed.includes(id)))
        return fail(409, "Состав изменился. Обновите список и проверьте последствия.");
      if (action === "detach")
        updateCohort(target, { courseIds: group.courseIds.filter((courseId) => courseId !== id) });
      else excludeStudents(id, affected);
    } else return fail(404, "not found");
    return new NextResponse(null, { status: 204 });
  }
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
    if (isExcluded(id, student.id)) return fail(409, "Сначала восстановите доступ студента");
    enrollStudent(id, student.id, "manual");
  } else return fail(404, "not found");
  return NextResponse.json({ ok: true });
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
