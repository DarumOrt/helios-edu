import { NextResponse } from "next/server";
import { courses } from "@/mocks/data";

export async function GET() {
  return NextResponse.json(courses.map(({ sections, ...rest }) => rest));
}
