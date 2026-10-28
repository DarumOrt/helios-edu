import { NextResponse } from "next/server";
import { findDemoCourse } from "@/mocks/course-store";
import { setCover, withCover } from "@/mocks/course-cover-store";
import { isCoverColor } from "@/shared/lib/cover-colors";
import { backendForward } from "@/shared/lib/backend";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,/;

// PUT { coverColor } — сменить цвет шаблона; { cover } — своя картинка; { cover: null } — убрать картинку.
// Сервер — C# (CourseBuilderEndpoints.UpdateCoverAsync): картинка — загруженный файл /api/files/…, права проверяет он.
// Демо — моки ниже: картинка — data URL до 2 МБ в памяти.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/courses/${encodeURIComponent(id)}/cover`);
  if (forwarded) return forwarded;
  const course = findDemoCourse(id);
  if (!course) return NextResponse.json({ error: "Курс не найден" }, { status: 404 });

  let body: { coverColor?: unknown; cover?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (body.coverColor !== undefined) {
    if (!isCoverColor(body.coverColor)) {
      return NextResponse.json({ error: "Неизвестный цвет обложки" }, { status: 400 });
    }
    setCover(id, { coverColor: body.coverColor });
  }

  if (body.cover === null) {
    setCover(id, { cover: null });
  } else if (body.cover !== undefined) {
    if (typeof body.cover !== "string" || !IMAGE_DATA_URL.test(body.cover)) {
      return NextResponse.json({ error: "Подойдёт картинка PNG, JPG или WebP" }, { status: 400 });
    }
    // base64 раздувает размер примерно на треть
    if (body.cover.length * 0.75 > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Картинка больше 2 МБ — уменьшите её" }, { status: 413 });
    }
    setCover(id, { cover: body.cover });
  }

  return NextResponse.json(withCover(course));
}
