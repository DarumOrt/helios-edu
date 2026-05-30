import { NextResponse } from "next/server";
import { users } from "@/mocks/data";

export async function GET() {
  return NextResponse.json(users);
}
