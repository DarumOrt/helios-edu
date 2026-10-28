import { NextResponse, type NextRequest } from "next/server";
import { backendGet, isSameOrigin } from "@/shared/lib/backend";
import { actionForMockApi, can } from "@/shared/auth/permissions";
import { type User } from "@/shared/types/domain";
import { DATA_SOURCE_COOKIE, resolveDataSource } from "@/shared/lib/data-source";

// Курс, к которому относится запрос, если он задан в пути (а не в ?courseId=): обложка, модули, материалы.
// Без этого преподаватель изменил бы чужой курс по прямой ссылке.
function courseFromPath(path: string): string | undefined {
  const nested = /^\/api\/courses\/([^/]+)\/.+$/.exec(path)?.[1];
  return nested ? decodeURIComponent(nested) : undefined;
}

// Эти маршруты пересылаются в C#, права проверяет он: адаптивное обучение (ученик курса, преподаватель курса,
// своя попытка), сданные работы, журнал оценок, объявления, уведомления, файлы курсов, настройки и журнал действий,
// трекинг, аналитика, лидерборд и расписание.
function checkedByApi(path: string): boolean {
  return (
    /^\/api\/(assignment|submissions|gradebook|notifications|files|tracking|analytics|hub)(\/|$)/.test(
      path,
    ) ||
    path === "/api/schedule" ||
    /^\/api\/courses\/[^/]+\/announcements$/.test(path) ||
    /^\/api\/courses\/[^/]+\/(skills|quizzes|adaptive|events)(\/|$)/.test(path) ||
    /^\/api\/courses\/[^/]+\/activities\/[^/]+\/skills$/.test(path) ||
    /^\/api\/courses\/[^/]+\/(impact|restore|trash)(\/|$)/.test(path) ||
    /^\/api\/users\/[^/]+\/password-reset$/.test(path) ||
    /^\/api\/(attempts|me)\//.test(path) ||
    path === "/api/settings" ||
    path === "/api/audit"
  );
}

export async function proxy(request: NextRequest) {
  // В демо-режиме данные — моки, серверной сессии нет: права проверяют сами моковые маршруты
  // (управление, конструктор, оценки и сдача работ — по демо-актору), остальное — интерфейс.
  if (resolveDataSource(request.cookies.get(DATA_SOURCE_COOKIE)?.value).source === "demo")
    return NextResponse.next();
  const path = request.nextUrl.pathname;
  // Эти маршруты проверяются самим C# API; health и выбор источника данных — публичные.
  if (
    path === "/api/health" ||
    path === "/api/data-source" ||
    path.startsWith("/api/auth/") ||
    path === "/api/users" ||
    /^\/api\/users\/[^/]+$/.test(path) ||
    path === "/api/courses" ||
    /^\/api\/courses\/[^/]+$/.test(path) ||
    path === "/api/catalog" ||
    checkedByApi(path)
  )
    return NextResponse.next();
  const session = await backendGet("/api/auth/me");
  if (!session?.ok) return session ?? Response.json({ error: "Сервис недоступен" }, { status: 503 });
  const user = (await session.json()) as User;
  const action = actionForMockApi(path, request.method);
  const forbidden = () => Response.json({ error: "Недостаточно прав" }, { status: 403 });
  if (!action || !can(user.role, action)) return forbidden();

  const fromPath = courseFromPath(path);
  let courseId = fromPath ?? request.nextUrl.searchParams.get("courseId");
  if (!["GET", "HEAD"].includes(request.method) && !isSameOrigin(request)) return forbidden();
  if (!["GET", "HEAD", "DELETE"].includes(request.method)) {
    let body: Record<string, unknown>;
    try {
      body = (await request.clone().json()) as Record<string, unknown>;
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Некорректное тело");
    } catch {
      return Response.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    if (!fromPath && typeof body.courseId === "string") courseId = body.courseId;
  }
  if (courseId) {
    // C# отдаёт курс, только если он виден пользователю (свой для преподавателя)
    const course = await backendGet(`/api/courses/${encodeURIComponent(courseId)}`);
    if (!course?.ok) return course ?? forbidden();
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
