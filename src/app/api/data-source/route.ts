import { NextResponse } from "next/server";
import { getDataSource, isSameOrigin } from "@/shared/lib/backend";
import { DATA_SOURCE_COOKIE, type DataSource } from "@/shared/lib/data-source";

export async function GET() {
  return NextResponse.json(await getDataSource());
}

// POST { source: "demo" | "server" } — переключатель «Демо / Сервер».
// Сессия в C# API при переключении не трогается: вернувшись на сервер, пользователь остаётся вошедшим.
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403 });

  let body: { source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const source = body.source;
  if (source !== "demo" && source !== "server")
    return NextResponse.json({ error: "Неизвестный источник данных" }, { status: 400 });

  const state = await getDataSource();
  if (source === "server" && !state.serverAvailable)
    return NextResponse.json({ error: "Сервер не подключён" }, { status: 409 });
  if (source === "demo" && !state.demoAllowed)
    return NextResponse.json({ error: "Демо-режим отключён" }, { status: 409 });

  const response = NextResponse.json({ ...state, source: source satisfies DataSource });
  response.cookies.set(DATA_SOURCE_COOKIE, source, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
