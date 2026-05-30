import { NextResponse } from "next/server";
import { cohorts } from "@/mocks/data";

export async function GET() {
  return NextResponse.json(cohorts);
}
