import { NextResponse } from "next/server";
import { courses } from "@/mocks/data";
import { backendGet } from "@/shared/lib/backend";

export async function GET() {
  const response = await backendGet("/api/courses");
  if (response) return response;
  return NextResponse.json(courses.map(({ sections, ...rest }) => rest));
}
