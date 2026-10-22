import { getSettings } from "@/mocks/settings-store";
import { NextResponse } from "next/server";
import { addAnnouncement, listAnnouncements } from "@/mocks/announcements-store";
import { currentUser, visibleCourses } from "@/mocks/current-user";
import { demoCourseEditor, fail, readJson, str } from "@/mocks/management-guards";
import { getDataSource } from "@/shared/lib/backend";

// Объявления курса. Хранятся в моках Next в обоих режимах; видимость курса — по правилам C#.
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const courses = await visibleCourses();
  if (courses instanceof Response) return courses;
  if (!courses.some((c) => c.id === id)) return fail(404, "not found");
  return NextResponse.json(listAnnouncements([id]));
}

// POST { title, body } — объявление всем, кто видит курс (студентам его групп)
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  // сервер: курс и право course.edit уже проверил proxy.ts; демо — проверяем здесь
  if ((await getDataSource()).source === "demo") {
    const editor = await demoCourseEditor(id);
    if (editor instanceof NextResponse) return editor;
  }
  if (!getSettings().announcementsEnabled) return fail(403, "Объявления отключены администратором");
  const author = await currentUser();
  if (author instanceof Response) return author;

  const body = await readJson(req);
  const title = str(body?.title) ?? "";
  const text = str(body?.body) ?? "";
  const fields: Record<string, string> = {};
  if (title.length < 3 || title.length > 120) fields.title = "Заголовок — от 3 до 120 символов";
  if (!text || text.length > 2000) fields.body = "Текст — от 1 до 2000 символов";
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  return NextResponse.json(addAnnouncement({ courseId: id, title, body: text, authorName: author.name }), {
    status: 201,
  });
}
