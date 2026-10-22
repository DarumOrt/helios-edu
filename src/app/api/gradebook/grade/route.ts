import { audit } from "@/mocks/audit-store";
import { NextResponse } from "next/server";
import { setGrade } from "@/mocks/gradebook-store";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    courseId: string;
    userId: string;
    itemId: string;
    grade: number | null;
  };
  const row = setGrade(body.courseId, body.userId, body.itemId, body.grade);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  await audit("Изменена оценка", `${row.userName} · ${body.courseId} · ${body.itemId}: ${body.grade ?? "—"}`);
  return NextResponse.json(row);
}
