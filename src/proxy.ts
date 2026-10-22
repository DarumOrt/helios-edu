import { NextResponse, type NextRequest } from "next/server";
import { backendGet, isSameOrigin } from "@/shared/lib/backend";
import { actionForMockApi, can } from "@/shared/auth/permissions";
import { type User } from "@/shared/types/domain";
import { DATA_SOURCE_COOKIE, resolveDataSource } from "@/shared/lib/data-source";

export async function proxy(request: NextRequest) {
  // В демо-режиме данные — моки, серверной сессии нет; права показывает только интерфейс.
  if (resolveDataSource(request.cookies.get(DATA_SOURCE_COOKIE)?.value).source === "demo")
    return NextResponse.next();
  const path = request.nextUrl.pathname;
  // Эти маршруты проверяются самим C# API; health и выбор источника данных — публичные.
  if (
    path === "/api/health" ||
    path === "/api/data-source" ||
    path.startsWith("/api/auth/") ||
    path === "/api/users" ||
    path === "/api/courses" ||
    /^\/api\/courses\/[^/]+$/.test(path)
  )
    return NextResponse.next();
  const session = await backendGet("/api/auth/me");
  if (!session?.ok) return session ?? Response.json({ error: "Сервис недоступен" }, { status: 503 });
  const user = (await session.json()) as User;
  const action = actionForMockApi(path, request.method);
  const forbidden = () => Response.json({ error: "Недостаточно прав" }, { status: 403 });
  if (!action || !can(user.role, action)) return forbidden();

  const requestedUser = request.nextUrl.searchParams.get("userId");
  const requestedGroup = request.nextUrl.searchParams.get("group");
  if (path === "/api/schedule" && !can(user.role, "analytics.view") && requestedGroup !== user.group)
    return forbidden();
  const coverCourseId = /^\/api\/courses\/([^/]+)\/cover$/.exec(path)?.[1];
  let courseId = request.nextUrl.searchParams.get("courseId");
  if (requestedUser && requestedUser !== user.id && !can(user.role, "analytics.view")) return forbidden();
  if (!["GET", "HEAD"].includes(request.method)) {
    if (!isSameOrigin(request)) return forbidden();
    let body: Record<string, unknown>;
    try {
      body = (await request.clone().json()) as Record<string, unknown>;
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Некорректное тело");
    } catch {
      return Response.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    if (/^\/api\/(tracking|quiz|assignment)\//.test(path) && body.userId && body.userId !== user.id)
      return forbidden();
    if (typeof body.courseId === "string") courseId = body.courseId;
    if (
      path === "/api/tracking/events" &&
      (!Array.isArray(body.events) ||
        body.events.some(
          (event: unknown) =>
            !event || typeof event !== "object" || !("userId" in event) || event.userId !== user.id,
        ))
    )
      return forbidden();
    if (path === "/api/tracking/progress" && body.userId !== user.id) return forbidden();
  }
  if (coverCourseId || courseId) {
    const course = await backendGet(`/api/courses/${coverCourseId ?? encodeURIComponent(courseId!)}`);
    if (!course?.ok) return course ?? forbidden();
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
