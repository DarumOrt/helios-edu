import { NextResponse } from "next/server";
import { getStudentGrades } from "@/mocks/gradebook-store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  return NextResponse.json({ courses: getStudentGrades(userId) });
}
