import { NextResponse } from "next/server";
import { programs } from "@/mocks/data";

export async function GET() {
  return NextResponse.json(programs);
}
