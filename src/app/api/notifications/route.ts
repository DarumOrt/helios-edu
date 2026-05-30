import { NextResponse } from "next/server";
import { notifications } from "@/mocks/data";

export async function GET() {
  return NextResponse.json(notifications);
}
