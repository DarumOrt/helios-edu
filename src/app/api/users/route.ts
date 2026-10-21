import { NextResponse } from "next/server";
import { users } from "@/mocks/data";

// GET ?group=М1217 — только участники группы
export async function GET(req: Request) {
  const group = new URL(req.url).searchParams.get("group");
  return NextResponse.json(group ? users.filter((u) => u.group === group) : users);
}
