import { NextResponse } from "next/server";
import { getStudentGrades } from "@/mocks/gradebook-store";
import { backendForward } from "@/shared/lib/backend";

// GET — оценки ученика по всем курсам. Сервер — C# (ученик из сессии, ?userId не нужен), демо — моки.
export async function GET(req: Request) {
  const forwarded = await backendForward(req, "/api/gradebook/me");
  if (forwarded) return forwarded;
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  return NextResponse.json({ courses: getStudentGrades(userId) });
}
